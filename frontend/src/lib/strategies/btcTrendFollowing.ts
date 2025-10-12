import { loadBtcOnly } from '@/lib/priceFeed';
import { calculateRSI } from '@/lib/indicators';
import type { SimulationResult, Trade, DailyPerformance } from '@/lib/types';

export interface Strategy {
  id: 'btc-trend-following';
  name: string;
  run: (initialCapital: number, startDate: string, endDate: string) => Promise<SimulationResult>;
}

const EVAL_INTERVAL_DAYS = 7; // evaluate weekly
const SMA_LENGTH = 50; // 50-day SMA
const RSI_LENGTH = 14;
const ENTRY_RSI = 60; // wider confirmation band: stronger RSI for entry
const BUFFER_BPS = 50; // 0.5% price buffer around SMA
const SLOPE_LOOKBACK_DAYS = 5; // SMA must be rising over this lookback

async function run(initialCapital: number, startDate: string, endDate: string): Promise<SimulationResult> {
  const btcData = await loadBtcOnly(startDate, endDate, SMA_LENGTH + 30);

  const dates = btcData.map(d => d.date);
  const prices = btcData.map(d => d.close);
  const rsi = calculateRSI(prices, RSI_LENGTH);
  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in BTC data');

  let usdc = initialCapital;
  let btcQty = 0;
  const trades: Trade[] = [];
  const dailyPerformance: DailyPerformance[] = [];

  // Benchmark HODL BTC
  const btcStartPrice = prices[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - 0.003)) / btcStartPrice;

  let maxPortfolioValue = initialCapital;
  let maxBtcHodlValue = initialCapital;

  const toDate = (s: string) => new Date(s + 'T00:00:00Z');
  let nextEvalDate = toDate(dates[startIdx]);
  nextEvalDate.setDate(nextEvalDate.getDate() + EVAL_INTERVAL_DAYS);

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
      // Price buffer around SMA to avoid whipsaws
      const entryThresh = sma * (1 + BUFFER_BPS / 10_000);
      // RSI filters
      const rsiNow = rsi[i];
      const enterConfirmed = btcPrice > entryThresh && rsiNow > ENTRY_RSI;
      // Aggressive exit: drop below SMA50 exits immediately
      const exitConfirmed = btcPrice < sma;
      // SMA slope filter
      const slopeOk = i - SLOPE_LOOKBACK_DAYS >= 0 ? smaAt(i, SMA_LENGTH)! > smaAt(i - SLOPE_LOOKBACK_DAYS, SMA_LENGTH)! : true;

      if (enterConfirmed && slopeOk && usdc > 1) {
        // BUY 100% USDC into BTC
        const fee = usdc * 0.003;
        const qty = (usdc * (1.0 - 0.003)) / btcPrice;
        btcQty += qty; usdc = 0;
        trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: qty * btcPrice, fee, portfolioValue: usdc + btcQty * btcPrice });
      } else if (exitConfirmed && btcQty > 0) {
        // SELL 100% BTC into USDC
        const gross = btcQty * btcPrice;
        const fee = gross * 0.003;
        const value = gross * (1.0 - 0.003);
        trades.push({ date, symbol: 'BTC', side: 'SELL', price: btcPrice, quantity: btcQty, value: gross, fee, portfolioValue: usdc + value });
        usdc += value; btcQty = 0;
      }
      nextEvalDate.setDate(nextEvalDate.getDate() + EVAL_INTERVAL_DAYS);
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

  const dailyReturns: number[] = [];
  for (let i = 1; i < dailyPerformance.length; i++) {
    const prev = dailyPerformance[i - 1].totalValue;
    const curr = dailyPerformance[i].totalValue;
    dailyReturns.push((curr / prev) - 1.0);
  }
  const meanDaily = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdDaily = Math.sqrt(dailyReturns.reduce((acc, r) => acc + Math.pow(r - meanDaily, 2), 0) / (dailyReturns.length > 1 ? (dailyReturns.length - 1) : 1));
  const sharpeRatio = stdDaily > 0 ? (meanDaily / stdDaily) * Math.sqrt(365) : 0;

  const downside = dailyReturns.filter(r => r < 0);
  const meanDown = downside.reduce((a, b) => a + b, 0) / (downside.length || 1);
  const downDev = Math.sqrt(downside.reduce((acc, r) => acc + Math.pow(r - meanDown, 2), 0) / (downside.length > 1 ? (downside.length - 1) : 1));
  const sortinoRatio = downDev > 0 ? (meanDaily / downDev) * Math.sqrt(365) : 0;

  // BTC HODL risk metrics
  const btcDailyReturns: number[] = [];
  for (let i = 1; i < dailyPerformance.length; i++) {
    const prev = dailyPerformance[i - 1].btcHodlValue;
    const curr = dailyPerformance[i].btcHodlValue;
    btcDailyReturns.push((curr / prev) - 1.0);
  }
  const btcMeanDaily = btcDailyReturns.reduce((a, b) => a + b, 0) / (btcDailyReturns.length || 1);
  const btcStdDaily = Math.sqrt(btcDailyReturns.reduce((acc, r) => acc + Math.pow(r - btcMeanDaily, 2), 0) / (btcDailyReturns.length > 1 ? (btcDailyReturns.length - 1) : 1));
  const btcHodlSharpeRatio = btcStdDaily > 0 ? (btcMeanDaily / btcStdDaily) * Math.sqrt(365) : 0;
  const btcDownside = btcDailyReturns.filter(r => r < 0);
  const btcMeanDown = btcDownside.reduce((a, b) => a + b, 0) / (btcDownside.length || 1);
  const btcDownDev = Math.sqrt(btcDownside.reduce((acc, r) => acc + Math.pow(r - btcMeanDown, 2), 0) / (btcDownside.length > 1 ? (btcDownside.length - 1) : 1));
  const btcHodlSortinoRatio = btcDownDev > 0 ? (btcMeanDaily / btcDownDev) * Math.sqrt(365) : 0;

  return {
    dailyPerformance,
    trades,
    strategyId: 'btc-trend-following',
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
  id: 'btc-trend-following',
  name: 'BTC Trend Following (50D SMA, weekly)',
  run,
};

export default strategy;


