import type { PriceData } from '@/lib/types';
import type { SimulationResult, Trade, DailyPerformance } from '@/lib/types';
import { computeReturnsFromValues, computeSharpeAndSortinoFromReturns } from '@/lib/stats';

export interface Strategy {
  id: 'trend-btc-dca';
  name: string;
  run: (
    initialCapital: number,
    startDate: string,
    endDate: string,
    options: {
      prices: { btc: PriceData[] };
      evalIntervalDays?: number;
      feePct?: number;
      // DCA configuration
      dcaPctWhenBearish?: number;
      discountBelowSmaPct?: number;
      dcaBoostMultiplier?: number;
      minCashUsd?: number;
      minSpendUsd?: number;
      // Trend filter configuration
      hystBps?: number;           // hysteresis band in basis points (default 150 = 1.5%)
      slopeLookbackDays?: number; // SMA slope lookback (default 14)
    }
  ) => Promise<SimulationResult>;
}

const DEFAULT_EVAL_INTERVAL_DAYS = 5; // evaluate roughly weekly
const SMA_LENGTH = 50; // SMA period for trend
const DEFAULT_SLOPE_LOOKBACK_DAYS = 14; // slope window
const DEFAULT_HYST_BPS = 150; // 1.5% hysteresis band
const DEFAULT_DCA_PCT_WHEN_BEARISH = 0.05; // 5% base DCA
const DEFAULT_DISCOUNT_BELOW_SMA_PCT = 15; // boost when price ≥15% below SMA
const DEFAULT_DCA_BOOST_MULTIPLIER = 2; // 2x DCA when discounted
const DEFAULT_FEE_PCT = 0.003; // 0.3%
const DEFAULT_MIN_CASH_USD = 100; // only DCA if we have at least this much USDC
const DEFAULT_MIN_SPEND_USD = 1; // minimum spend per DCA
const DEFAULT_DCA_MODE = false;

export async function run(initialCapital: number, startDate: string, endDate: string, options: { prices: { btc: PriceData[] }; dcaPctWhenBearish?: number; evalIntervalDays?: number; feePct?: number; discountBelowSmaPct?: number; dcaBoostMultiplier?: number; minCashUsd?: number; minSpendUsd?: number; hystBps?: number; slopeLookbackDays?: number }): Promise<SimulationResult> {
  const btcData = options.prices.btc;
  const dcaPct = Math.max(0, Math.min(1, options.dcaPctWhenBearish ?? DEFAULT_DCA_PCT_WHEN_BEARISH));
  const evalIntervalDays = Math.max(1, Math.floor(options.evalIntervalDays ?? DEFAULT_EVAL_INTERVAL_DAYS));
  const feePct = options.feePct ?? DEFAULT_FEE_PCT;
  const discountBelowSmaPct = Math.max(0, options.discountBelowSmaPct ?? DEFAULT_DISCOUNT_BELOW_SMA_PCT);
  const dcaBoostMultiplier = Math.max(1, options.dcaBoostMultiplier ?? DEFAULT_DCA_BOOST_MULTIPLIER);
  const minCashUsd = Math.max(0, options.minCashUsd ?? DEFAULT_MIN_CASH_USD);
  const minSpendUsd = Math.max(0, options.minSpendUsd ?? DEFAULT_MIN_SPEND_USD);
  const hystBps = Math.max(0, Math.floor(options.hystBps ?? DEFAULT_HYST_BPS));
  const slopeLookback = Math.max(1, Math.floor(options.slopeLookbackDays ?? DEFAULT_SLOPE_LOOKBACK_DAYS));

  const dates = btcData.map(d => d.date);
  const prices = btcData.map(d => d.close);
  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in BTC data');

  let usdc = initialCapital;
  let btcQty = 0;
  let inDcaMode = DEFAULT_DCA_MODE;
  const trades: Trade[] = [];
  const dailyPerformance: DailyPerformance[] = [];

  // Benchmark HODL BTC
  const btcStartPrice = prices[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - 0.003)) / btcStartPrice;

  let maxPortfolioValue = initialCapital;
  let maxBtcHodlValue = initialCapital;

  const toDate = (s: string) => new Date(s + 'T00:00:00Z');
  let nextEvalDate = toDate(dates[startIdx]);
  nextEvalDate.setDate(nextEvalDate.getDate() + evalIntervalDays);

  // Initial day
  dailyPerformance.push({
    date: dates[startIdx],
    cash: usdc,
    btcQty: 0,
    ethQty: 0,
    btcValue: 0,
    ethValue: 0,
    totalValue: initialCapital,
    btcHodlValue: initialCapital,
    drawdown: 0,
    btcHodlDrawdown: 0,
    btcPrice: prices[startIdx],
    ethPrice: 0,
    btcSma50: (() => {
      // compute SMA with full lookback so it's available from day 1
      if (startIdx + 1 < SMA_LENGTH) return undefined;
      let sum = 0;
      for (let k = startIdx - SMA_LENGTH + 1; k <= startIdx; k++) sum += prices[k];
      return sum / SMA_LENGTH;
    })(),
  });

  // SMA helper over prices
  const smaAt = (i: number, length: number) => {
    if (i + 1 < length) return null;
    let sum = 0;
    for (let k = i - length + 1; k <= i; k++) sum += prices[k];
    return sum / length;
  };

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const btcPrice = prices[i];
    const sma = smaAt(i, SMA_LENGTH);

    // Evaluate weekly
    const currDate = toDate(date);
    if (sma !== null && currDate >= nextEvalDate) {
      // Hysteresis thresholds and slope gate
      const upThresh = sma * (1 + hystBps / 10_000);
      const dnThresh = sma * (1 - hystBps / 10_000);
      const slopeOk = i - slopeLookback >= 0 ? smaAt(i, SMA_LENGTH)! > smaAt(i - slopeLookback, SMA_LENGTH)! : true;
      const enterUp = btcPrice > upThresh && slopeOk;
      const exitUp = btcPrice < dnThresh || !slopeOk;

      if (!inDcaMode && enterUp && usdc >= 1) {
        // BUY 100% USDC into BTC
        const fee = usdc * feePct;
        const qty = (usdc * (1.0 - feePct)) / btcPrice;
        btcQty += qty; usdc = 0;
        trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: qty * btcPrice, fee, portfolioValue: usdc + btcQty * btcPrice });
        inDcaMode = false;
      } else if (!inDcaMode && exitUp && btcQty > 0) {
        // On first confirmed exit, sell 100% BTC to USDC, then enter DCA mode
        const gross = btcQty * btcPrice;
        const fee = gross * feePct;
        const value = gross * (1.0 - feePct);
        trades.push({ date, symbol: 'BTC', side: 'SELL', price: btcPrice, quantity: btcQty, value: gross, fee, portfolioValue: usdc + value });
        usdc += value; btcQty = 0;
        inDcaMode = true;
      } else if (inDcaMode && !enterUp && usdc > minCashUsd) {
        // DCA gently while trend is not up
        let spend = Math.min(usdc, usdc * dcaPct);
        const discount = 1 - (btcPrice / sma);
        if (discount * 100 >= discountBelowSmaPct) {
          spend = Math.min(usdc, spend * dcaBoostMultiplier);
        }
        if (spend >= minSpendUsd) {
          const fee = spend * feePct;
          const net = spend * (1.0 - feePct);
          const qty = net / btcPrice;
          btcQty += qty;
          usdc -= (spend);
          trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: spend, fee, portfolioValue: usdc + btcQty * btcPrice });
        }
      } else if (inDcaMode && enterUp && usdc >= 1) {
        // Switch from DCA to full BTC when trend resumes
        const fee = usdc * feePct;
        const qty = (usdc * (1.0 - feePct)) / btcPrice;
        btcQty += qty; usdc = 0;
        trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: qty * btcPrice, fee, portfolioValue: usdc + btcQty * btcPrice });
        inDcaMode = false;
      }
      nextEvalDate.setDate(nextEvalDate.getDate() + evalIntervalDays);
    }

    const btcValue = btcQty * btcPrice;
    const portfolioValue = usdc + btcValue;
    const btcHodlValue = btcHodlQty * btcPrice;
    maxPortfolioValue = Math.max(maxPortfolioValue, portfolioValue);
    maxBtcHodlValue = Math.max(maxBtcHodlValue, btcHodlValue);
    const drawdown = ((portfolioValue / maxPortfolioValue) - 1.0) * 100;
    const btcHodlDrawdown = ((btcHodlValue / maxBtcHodlValue) - 1.0) * 100;

    dailyPerformance.push({
      date,
      cash: usdc,
      btcQty,
      ethQty: 0,
      btcValue,
      ethValue: 0,
      totalValue: portfolioValue,
      btcHodlValue,
      drawdown,
      btcHodlDrawdown,
      btcPrice,
      ethPrice: 0,
      btcSma50: sma === null ? undefined : sma,
    });
  }

  const finalPerf = dailyPerformance[dailyPerformance.length - 1];
  const totalReturn = ((finalPerf.totalValue / initialCapital) - 1.0) * 100;
  const start = new Date(dates[startIdx]);
  const end = new Date(dates[dates.length - 1]);
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const years = days / 365.2425;
  const cagr = (years < 1)
    ? ((finalPerf.totalValue / initialCapital - 1.0) * (365.2425 / days)) * 100
    : (Math.pow(finalPerf.totalValue / initialCapital, 1 / years) - 1.0) * 100;
  const btcHodlReturn = ((finalPerf.btcHodlValue / initialCapital) - 1.0) * 100;
  const btcHodlCagr = (years < 1)
    ? ((finalPerf.btcHodlValue / initialCapital - 1.0) * (365.2425 / days)) * 100
    : (Math.pow(finalPerf.btcHodlValue / initialCapital, 1 / years) - 1.0) * 100;
  const maxDrawdown = Math.min(...dailyPerformance.map(d => d.drawdown));

  // Risk metrics via shared helpers
  const dailyReturns = computeReturnsFromValues(dailyPerformance.map(d => d.totalValue));
  const { sharpe: sharpeRatio, sortino: sortinoRatio } = computeSharpeAndSortinoFromReturns(dailyReturns);

  // BTC HODL risk metrics
  const btcDailyReturns = computeReturnsFromValues(dailyPerformance.map(d => d.btcHodlValue));
  const { sharpe: btcHodlSharpeRatio, sortino: btcHodlSortinoRatio } = computeSharpeAndSortinoFromReturns(btcDailyReturns);

  return {
    dailyPerformance,
    trades,
    strategyId: 'trend-btc-dca',
    summary: {
      initialCapital,
      finalValue: finalPerf.totalValue,
      totalReturn,
      cagr,
      maxDrawdown,
      totalTrades: trades.length,
      sharpeRatio,
      sortinoRatio,
      btcHodlFinalValue: finalPerf.btcHodlValue,
      btcHodlReturn,
      btcHodlCagr,
      btcHodlMaxDrawdown: Math.min(...dailyPerformance.map(d => d.btcHodlDrawdown)),
      btcHodlSharpeRatio,
      btcHodlSortinoRatio,
      outperformance: cagr - ((years < 1)
        ? ((finalPerf.btcHodlValue / initialCapital - 1.0) * (365.2425 / days) * 100)
        : ((Math.pow(finalPerf.btcHodlValue / initialCapital, 1 / years) - 1.0) * 100)),
    },
  };
}

const strategy: Strategy = {
  id: 'trend-btc-dca',
  name: 'Trend BTC DCA (SMA50, weekly)',
  run,
};

export default strategy;


