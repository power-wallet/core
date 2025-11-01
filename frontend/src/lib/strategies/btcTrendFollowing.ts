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
  getDefaultParameters: () => Record<string, any>;
  getParameterMeta: () => Record<string, any>;
}

// Centralized default parameters for the strategy
export const DEFAULT_PARAMETERS = {
  evalIntervalDays: {
    name: 'Interval (days)',
    defaultValue: 5,
    type: 'days',
    description: 'Strategy evaluation interval (default 5 days)',
    configurable: true,
  },
  dcaPctWhenBearish: {
    name: 'Base DCA (%)',
    defaultValue: 0.05,
    minPerc: 1,
    maxPerc: 25,
    percInc: 1,
    type: 'percentage',
    description: 'Base DCA percentage when in downtrend',
    configurable: true,
  },
  dcaMode: {
    name: 'DCA mode',
    defaultValue: true,
    type: 'boolean',
    description: 'Start in DCA mode',
    configurable: false,
  },
  hystBps: {
    name: 'SMA Hysteresis Band (%)',
    defaultValue: 0.015,
    type: 'percentage',
    minPerc: 0.1,
    maxPerc: 10,
    percInc: 0.1,
    description: 'Hysteresis band across SMA threshold (default 1.5%)',
    configurable: true,
  },
  slopeLookbackDays: {
    name: 'SMA slope (days)',
    defaultValue: 14,
    type: 'days',
    description: 'SMA slope lookback window for downtrend detection',
    configurable: true,
  },
  dcaBoostMultiplier: {
    name: 'DCA boost (x)',
    defaultValue: 2,
    type: 'number',
    description: 'Boost buys multiplier when price is discounted below SMA',
    configurable: true,
  },
  discountBelowSmaPct: {
    name: 'Discount below SMA (%)',
    defaultValue: 0.15,
    minPerc: 1,
    maxPerc: 100,
    percInc: 1,
    type: 'percentage',
    description: 'Discount % below SMA that triggers boost buys',
    configurable: true,
  },
  minCashUsd: {
    name: 'Min USDC to DCA (USD)',
    defaultValue: 1,
    type: 'number',
    description: 'Only DCA if we have at least this much USDC',
    configurable: false,
  },
  minSpendUsd: {
    name: 'Min spend per DCA (USD)',
    defaultValue: 1,
    type: 'number',
    description: 'Minimum spend per DCA',
    configurable: false,
  },
  tradingFee: {
    name: 'Fee (%)',
    defaultValue: 0.003,
    minPerc: 0,
    maxPerc: 0.5,
    percInc: 0.05,
    type: 'percentage',
    description: 'Trading fee (default 0.3%)',
    configurable: true,
  },
};

const SMA_LENGTH = 50; // SMA period for trend (kept constant for charting consistency)

export async function run(initialCapital: number, startDate: string, endDate: string, options: { prices: { btc: PriceData[] }; dcaPctWhenBearish?: number; evalIntervalDays?: number; feePct?: number; discountBelowSmaPct?: number; dcaBoostMultiplier?: number; minCashUsd?: number; minSpendUsd?: number; hystBps?: number; slopeLookbackDays?: number; dcaMode?: boolean; depositAmount?: number; depositIntervalDays?: number }): Promise<SimulationResult> {
  const btcData = options.prices.btc;
  const dcaPct = Math.max(0, Math.min(1, options.dcaPctWhenBearish ?? DEFAULT_PARAMETERS.dcaPctWhenBearish.defaultValue));
  const evalIntervalDays = Math.max(1, Math.floor(options.evalIntervalDays ?? DEFAULT_PARAMETERS.evalIntervalDays.defaultValue));
  const feePct = options.feePct ?? DEFAULT_PARAMETERS.tradingFee.defaultValue;
  const discountBelowSmaPct = Math.max(0, options.discountBelowSmaPct ?? DEFAULT_PARAMETERS.discountBelowSmaPct.defaultValue);
  const dcaBoostMultiplier = Math.max(1, options.dcaBoostMultiplier ?? DEFAULT_PARAMETERS.dcaBoostMultiplier.defaultValue);
  const minCashUsd = Math.max(0, options.minCashUsd ?? DEFAULT_PARAMETERS.minCashUsd.defaultValue);
  const minSpendUsd = Math.max(0, options.minSpendUsd ?? DEFAULT_PARAMETERS.minSpendUsd.defaultValue);
  // Hysteresis band is configured as a percentage fraction (e.g., 0.015 = 1.5%)
  const hystPct = Math.max(0, (options.hystBps ?? DEFAULT_PARAMETERS.hystBps.defaultValue));
  const slopeLookback = Math.max(1, Math.floor(options.slopeLookbackDays ?? DEFAULT_PARAMETERS.slopeLookbackDays.defaultValue));

  const dates = btcData.map(d => d.date);
  const prices = btcData.map(d => d.close);
  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in BTC data');

  const depositAmount = Math.max(0, options.depositAmount ?? 0);
  const depositIntervalDays = Math.max(0, Math.floor(options.depositIntervalDays ?? 0));
  // initialCapital is total contributions; start with first deposit only
  let usdc = depositAmount > 0 ? depositAmount : 0;
  let btcQty = 0;
  let inDcaMode = options.dcaMode ?? DEFAULT_PARAMETERS.dcaMode;
  const trades: Trade[] = [];
  const dailyPerformance: DailyPerformance[] = [];

  // Benchmark HODL BTC
  const btcStartPrice = prices[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - feePct)) / btcStartPrice;

  let maxPortfolioValue = usdc;
  let maxBtcHodlValue = initialCapital;

  const toDate = (s: string) => new Date(s + 'T00:00:00Z');
  let nextEvalDate = toDate(dates[startIdx]);
  nextEvalDate.setDate(nextEvalDate.getDate() + evalIntervalDays);

  console.log("initialCapital", initialCapital, "depositAmount", depositAmount, "usdc", usdc);
  console.log("btcHodlQty", btcHodlQty, "btcStartPrice", btcStartPrice);
  console.log("startDate", startDate, "endDate", endDate);
  console.log("dates", dates.length > 0 ? dates[0] : "no dates", "to",  dates.length > 0 ? dates[dates.length - 1] : "no dates");
  console.log("start btc prices", prices[startIdx], "date", dates[startIdx]);
  console.log("end btc prices", prices[dates.length - 1], "date", dates[dates.length - 1]);

  // Initial day
  dailyPerformance.push({
    date: dates[startIdx],
    cash: usdc,
    btcQty: 0,
    ethQty: 0,
    btcValue: 0,
    ethValue: 0,
    totalValue: usdc,
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

  // Deposit schedule
  let nextDepositDate = toDate(dates[startIdx]);
  if (depositIntervalDays > 0) {
    nextDepositDate.setDate(nextDepositDate.getDate() + depositIntervalDays);
  }

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const btcPrice = prices[i];
    const sma = smaAt(i, SMA_LENGTH);

    // Evaluate weekly
    const currDate = toDate(date);
    // Apply deposit before evaluation
    if (depositAmount > 0 && depositIntervalDays > 0 && currDate >= nextDepositDate) {
      usdc += depositAmount;
      nextDepositDate.setDate(nextDepositDate.getDate() + depositIntervalDays);
    }
    if (sma !== null && currDate >= nextEvalDate) {
      // Hysteresis thresholds and slope gate
      const upThresh = sma * (1 + hystPct);
      const dnThresh = sma * (1 - hystPct);
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
      } else if (inDcaMode && (btcPrice <= dnThresh) && usdc > minCashUsd) {
        // DCA only while price is below the lower threshold (downtrend)
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
        const spend = usdc;
        const fee = spend * feePct;
        const net = spend * (1.0 - feePct);
        const qty = net / btcPrice;
        btcQty += qty;
        usdc -= spend; // typically 0
        trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: spend, fee, portfolioValue: usdc + btcQty * btcPrice });
        // Mirror on-chain rule: only exit DCA if post-trade stable is effectively fully deployed
        if (usdc < minSpendUsd) {
          inDcaMode = false;
        }
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
  name: 'Trend aware DCA',
  run,
  getDefaultParameters: () => ({
    evalIntervalDays: DEFAULT_PARAMETERS.evalIntervalDays.defaultValue,
    dcaMode: DEFAULT_PARAMETERS.dcaMode.defaultValue,
    hystBps: DEFAULT_PARAMETERS.hystBps.defaultValue,
    slopeLookbackDays: DEFAULT_PARAMETERS.slopeLookbackDays.defaultValue,
    dcaPctWhenBearish: DEFAULT_PARAMETERS.dcaPctWhenBearish.defaultValue,
    dcaBoostMultiplier: DEFAULT_PARAMETERS.dcaBoostMultiplier.defaultValue,
    discountBelowSmaPct: DEFAULT_PARAMETERS.discountBelowSmaPct.defaultValue,
    minCashUsd: DEFAULT_PARAMETERS.minCashUsd.defaultValue,
    minSpendUsd: DEFAULT_PARAMETERS.minSpendUsd.defaultValue,
    feePct: DEFAULT_PARAMETERS.tradingFee.defaultValue,
  }),
  getParameterMeta: () => ({ ...DEFAULT_PARAMETERS }),
};

export default strategy;


