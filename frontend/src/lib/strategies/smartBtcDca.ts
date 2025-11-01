import type { SimulationResult, Trade, DailyPerformance, PriceData } from '@/lib/types';
import { computeReturnsFromValues, computeSharpeAndSortinoFromReturns } from '@/lib/stats';

export interface Strategy {
  id: 'smart-btc-dca';
  name: string;
  run: (
    initialCapital: number,
    startDate: string,
    endDate: string,
    options: { prices: { btc: PriceData[] } }
  ) => Promise<SimulationResult>;
  getDefaultParameters: () => Record<string, any>;
  getParameterMeta: () => Record<string, any>;
}

// Centralized default parameters (adapted from adaptive_dca_btc.py)
export const DEFAULT_PARAMETERS = {
  evalIntervalDays: {
    name: 'Evaluate interval (days)',
    defaultValue: 7,
    type: 'days',
    description: 'How often to evaluate trading rules (default weekly)',
    configurable: true,
  },
  baseDcaUsdc: {
    name: 'DCA amount',
    defaultValue: 100.0,
    type: 'number',
    description: 'Base DCA amount per evaluation',
    configurable: true,
  },
  minTradeUsd: {
    name: 'Minimum trade (USD)',
    defaultValue: 1.0,
    type: 'number',
    description: 'Minimum trade size to execute/record',
    configurable: false,
  },
  lookbackDays: {
    name: 'Lookback (days)',
    defaultValue: 30,
    type: 'days',
    description: 'Rolling realized variance window',
    configurable: true,
  },
  kKicker: {
    name: 'Vol/drawdown coefficient',
    defaultValue: 0.05,
    type: 'number',
    description: 'Vol/drawdown sizing coefficient',
    configurable: true,
  },
  winsorizeAbsRet: {
    name: 'Winsorize abs return',
    defaultValue: 0.20,
    type: 'percentage',
    description: 'Clip absolute daily log return',
    configurable: true,
  },
  ewmaLambdaDaily: {
    name: 'EWMA lambda',
    defaultValue: 0.94,
    type: 'number',
    description: 'EWMA lambda',
    configurable: true,
  },
  bufferMult: {
    name: 'Buffer multiplier (days)',
    defaultValue: 9.0,
    type: 'number',
    description: 'Days of base DCA to keep as USDC buffer',
    configurable: true,
  },
  cmaxMult: {
    name: 'Extra buy cap (× DCA)',
    defaultValue: 3.0,
    type: 'number',
    description: 'Cap extra buy per evaluation = cmaxMult × baseDca',
    configurable: true,
  },
  thresholdMode: {
    name: 'Threshold rebalancing',
    defaultValue: true,
    type: 'boolean',
    description: 'Enable threshold rebalancing to band boundary',
    configurable: true,
  },
  targetBtcWeight: {
    name: 'Target BTC weight',
    defaultValue: 0.50,
    type: 'percentage',
    description: 'Target BTC weight',
    configurable: true,
  },
  bandDelta: {
    name: 'Weight band ±',
    defaultValue: 0.30,
    type: 'percentage',
    description: '± band around target weight',
    configurable: true,
  },
  rebalanceCapFrac: {
    name: 'Rebalance cap (NAV %)',
    defaultValue: 0.20,
    type: 'percentage',
    description: 'Cap single rebalance as fraction of NAV',
    configurable: true,
  },
  tradingFee: {
    name: 'Trading fee',
    defaultValue: 0.003,
    type: 'percentage',
    description: 'Trading fee assumption for BTC HODL benchmark',
    configurable: true,
  },
};

function calculateCAGR(startValue: number, endValue: number, startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const years = days / 365.2425;
  if (years < 1) return (endValue / startValue - 1.0) * (365.2425 / days);
  return Math.pow(endValue / startValue, 1 / years) - 1.0;
}

export async function run(
  initialCapital: number,
  startDate: string,
  endDate: string,
  options: {
    prices: { btc: PriceData[] };
    evalIntervalDays?: number;
    baseDcaUsdc?: number;
    minTradeUsd?: number;
    lookbackDays?: number;
    kKicker?: number;
    winsorizeAbsRet?: number;
    ewmaLambdaDaily?: number;
    bufferMult?: number;
    cmaxMult?: number;
    thresholdMode?: boolean;
    targetBtcWeight?: number;
    bandDelta?: number;
    rebalanceCapFrac?: number;
    tradingFee?: number;
    depositAmount?: number;
    depositIntervalDays?: number;
  }
): Promise<SimulationResult> {
  const btcData = options.prices.btc;
  const lookbackDays = Math.max(1, Math.floor(options.lookbackDays ?? DEFAULT_PARAMETERS.lookbackDays.defaultValue));
  const ewmaLambdaDaily = options.ewmaLambdaDaily ?? DEFAULT_PARAMETERS.ewmaLambdaDaily.defaultValue;
  const baseDcaUsdc = Math.max(0, options.baseDcaUsdc ?? DEFAULT_PARAMETERS.baseDcaUsdc.defaultValue);
  const evalIntervalDays = Math.max(1, Math.floor(options.evalIntervalDays ?? DEFAULT_PARAMETERS.evalIntervalDays.defaultValue));
  const targetBtcWeight = Math.min(1, Math.max(0, options.targetBtcWeight ?? DEFAULT_PARAMETERS.targetBtcWeight.defaultValue));
  const bandDelta = Math.min(1, Math.max(0, options.bandDelta ?? DEFAULT_PARAMETERS.bandDelta.defaultValue));
  const kKicker = Math.max(0, options.kKicker ?? DEFAULT_PARAMETERS.kKicker.defaultValue);
  const cmaxMult = Math.max(0, options.cmaxMult ?? DEFAULT_PARAMETERS.cmaxMult.defaultValue);
  const bufferMult = Math.max(0, options.bufferMult ?? DEFAULT_PARAMETERS.bufferMult.defaultValue);
  const minTradeUsd = Math.max(0, options.minTradeUsd ?? DEFAULT_PARAMETERS.minTradeUsd.defaultValue);
  const winsorizeAbsRet = Math.max(0, options.winsorizeAbsRet ?? DEFAULT_PARAMETERS.winsorizeAbsRet.defaultValue);
  const thresholdMode = options.thresholdMode ?? DEFAULT_PARAMETERS.thresholdMode.defaultValue;
  const rebalanceCapFrac = Math.min(1, Math.max(0, options.rebalanceCapFrac ?? DEFAULT_PARAMETERS.rebalanceCapFrac.defaultValue));
  const tradingFee = Math.max(0, options.tradingFee ?? DEFAULT_PARAMETERS.tradingFee.defaultValue);
  const dates = btcData.map(d => d.date);
  const closes = btcData.map(d => d.close);
  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in BTC data');

  // Portfolio state
  const depositAmount = Math.max(0, options.depositAmount ?? 0);
  const depositIntervalDays = Math.max(0, Math.floor(options.depositIntervalDays ?? 0));
  // initialCapital represents total contributions; start with first deposit as cash
  let usdc = depositAmount > 0 ? depositAmount : 0;
  let btcQty = 0;
  let maxPortfolioValue = usdc;
  let maxBtcHodlValue = initialCapital;

  // Benchmark HODL
  const btcStartPrice = closes[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - tradingFee)) / btcStartPrice;

  const trades: Trade[] = [];
  const dailyPerformance: DailyPerformance[] = [];

  // Rolling realized variance buffer and EWMA variance
  const buf: number[] = [];
  let sumR2 = 0.0;
  let ewmaSigma2 = 0.0;
  const warmup: number[] = [];

  // Buffer target (USDC)
  const bufferTarget = bufferMult * baseDcaUsdc;

  // Running peak for drawdown
  let runningPeak = closes[startIdx];
  let prevClose: number | null = null;

  console.log("initialCapital", initialCapital, "depositAmount", depositAmount, "usdc", usdc);
  console.log("btcHodlQty", btcHodlQty, "btcStartPrice", btcStartPrice);
  console.log("startDate", startDate, "endDate", endDate);
  console.log("dates", dates.length > 0 ? dates[0] : "no dates", "to",  dates.length > 0 ? dates[dates.length - 1] : "no dates");
  console.log("start btc prices", closes[startIdx], "date", dates[startIdx]);
  console.log("end btc prices", closes[dates.length - 1], "date", dates[dates.length - 1]);

  // Initial day perf
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
    btcPrice: closes[startIdx],
    ethPrice: 0,
  });

  // Evaluation cadence state
  const toDate = (s: string) => new Date(s + 'T00:00:00Z');
  let nextEvalDate = toDate(dates[startIdx]);
  nextEvalDate.setDate(nextEvalDate.getDate() + evalIntervalDays);
  // Deposit schedule
  let nextDepositDate = toDate(dates[startIdx]);
  if (depositIntervalDays > 0) {
    nextDepositDate.setDate(nextDepositDate.getDate() + depositIntervalDays);
  }

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const price = closes[i];
    const currDate = toDate(date);

    // Apply deposit if due (before evaluation)
    if (depositAmount > 0 && depositIntervalDays > 0 && currDate >= nextDepositDate) {
      usdc += depositAmount;
      nextDepositDate.setDate(nextDepositDate.getDate() + depositIntervalDays);
    }

    // Update drawdown
    runningPeak = Math.max(runningPeak, price);
    const drawdown = runningPeak > 0 ? Math.max(0, 1.0 - price / runningPeak) : 0;

    // Daily return (log), winsorized
    let r = 0;
    if (prevClose != null && prevClose > 0) {
      r = Math.log(price / prevClose);
      const w = winsorizeAbsRet;
      if (r > w) r = w; else if (r < -w) r = -w;
    }
    prevClose = price;

    // Rolling RV update over lookbackDays
    const r2 = r * r;
    if (buf.length === lookbackDays) {
      sumR2 -= buf[0];
      buf.shift();
    }
    buf.push(r2);
    sumR2 += r2;

    // EWMA update (after brief warmup)
    if (warmup.length < Math.min(10, Math.floor(lookbackDays / 3))) {
      warmup.push(r2);
      if (warmup.length === Math.min(10, Math.floor(lookbackDays / 3))) {
        ewmaSigma2 = warmup.reduce((a, b) => a + b, 0) / warmup.length;
      }
    } else {
      const lam = ewmaLambdaDaily;
      ewmaSigma2 = lam * ewmaSigma2 + (1 - lam) * r2;
    }

    // Annualized vols
    const rvAnn = buf.length > 0 ? Math.sqrt(sumR2 * (365.0 / buf.length)) : 0;
    const ewmaAnn = ewmaSigma2 > 0 ? Math.sqrt(ewmaSigma2 * 365.0) : 0;
    const sigmaAnn = Math.max(rvAnn, ewmaAnn);

    // Portfolio before trades
    const nav = usdc + btcQty * price;
    const btcValue = btcQty * price;
    const wBtc = nav > 0 ? btcValue / nav : 0;
    const wMinus = Math.max(0, targetBtcWeight - bandDelta);
    const wPlus = Math.min(1, targetBtcWeight + bandDelta);

    // Evaluate trading rules only on evaluation days
    if (currDate >= nextEvalDate) {
      // Threshold-mode optional rebalancing to band boundary
      if (thresholdMode && nav > 0) {
        if (wBtc > wPlus) {
          const targetBtcValue = wPlus * nav;
          const excessUsd = Math.max(0, btcValue - targetBtcValue);
          let tradeUsd = Math.min(excessUsd, rebalanceCapFrac * nav);
          if (tradeUsd >= minTradeUsd && price > 0) {
            let qty = tradeUsd / price;
            qty = Math.min(qty, btcQty);
            tradeUsd = qty * price;
            btcQty -= qty;
            usdc += tradeUsd;
            trades.push({ date, symbol: 'BTC', side: 'SELL', price, quantity: qty, value: tradeUsd, fee: 0, portfolioValue: usdc + btcQty * price });
          }
        } else if (wBtc < wMinus) {
          const targetBtcValue = wMinus * nav;
          const shortfallUsd = Math.max(0, targetBtcValue - btcValue);
          const tradeUsd = Math.min(shortfallUsd, usdc, rebalanceCapFrac * nav);
          if (tradeUsd >= minTradeUsd && price > 0) {
            const qty = tradeUsd / price;
            btcQty += qty;
            usdc -= tradeUsd;
            trades.push({ date, symbol: 'BTC', side: 'BUY', price, quantity: qty, value: tradeUsd, fee: 0, portfolioValue: usdc + btcQty * price });
          }
        }
        // If outside band we skip DCA logic for today
        if (wBtc > wPlus || wBtc < wMinus) {
          const portfolioValue = usdc + btcQty * price;
          const btcHodlValue = btcHodlQty * price;
          maxPortfolioValue = Math.max(maxPortfolioValue, portfolioValue);
          maxBtcHodlValue = Math.max(maxBtcHodlValue, btcHodlValue);
          const dd = ((portfolioValue / maxPortfolioValue) - 1.0) * 100;
          const hodlDD = ((btcHodlValue / maxBtcHodlValue) - 1.0) * 100;
          dailyPerformance.push({ date, cash: usdc, btcQty, ethQty: 0, btcValue: btcQty * price, ethValue: 0, totalValue: portfolioValue, btcHodlValue, drawdown: dd, btcHodlDrawdown: hodlDD, btcPrice: price, ethPrice: 0 });
          nextEvalDate.setDate(nextEvalDate.getDate() + evalIntervalDays);
          continue;
        }
      }

      // Buy-only logic (base DCA + volatility kicker)
      const availableToSpend = Math.max(0, usdc - bufferTarget);
      const baseBuy = Math.min(baseDcaUsdc, usdc);
      let buyBudget = baseBuy;
      // Kicker scaled by volatility and drawdown
      let extraBuy = kKicker * sigmaAnn * drawdown * nav;
      const extraCap = cmaxMult * baseDcaUsdc;
      extraBuy = Math.min(extraBuy, extraCap);
      extraBuy = Math.min(extraBuy, availableToSpend);
      buyBudget += Math.max(0, extraBuy);

      const buyUsd = Math.min(usdc, buyBudget);
      if (buyUsd >= minTradeUsd && price > 0) {
        const qty = buyUsd / price;
        btcQty += qty;
        usdc -= buyUsd;
        trades.push({ date, symbol: 'BTC', side: 'BUY', price, quantity: qty, value: buyUsd, fee: 0, portfolioValue: usdc + btcQty * price });
      }

      // Advance next evaluation date
      nextEvalDate.setDate(nextEvalDate.getDate() + evalIntervalDays);
    }

    // Daily performance
    const portfolioValue = usdc + btcQty * price;
    const btcHodlValue = btcHodlQty * price;
    maxPortfolioValue = Math.max(maxPortfolioValue, portfolioValue);
    maxBtcHodlValue = Math.max(maxBtcHodlValue, btcHodlValue);
    const dd = ((portfolioValue / maxPortfolioValue) - 1.0) * 100;
    const hodlDD = ((btcHodlValue / maxBtcHodlValue) - 1.0) * 100;
    dailyPerformance.push({ date, cash: usdc, btcQty, ethQty: 0, btcValue: btcQty * price, ethValue: 0, totalValue: portfolioValue, btcHodlValue, drawdown: dd, btcHodlDrawdown: hodlDD, btcPrice: price, ethPrice: 0 });
  }

  const finalPerf = dailyPerformance[dailyPerformance.length - 1];
  const totalReturn = ((finalPerf.totalValue / initialCapital) - 1.0) * 100;
  const cagr = calculateCAGR(initialCapital, finalPerf.totalValue, dates[startIdx], dates[dates.length - 1]) * 100;
  const btcHodlReturn = ((finalPerf.btcHodlValue / initialCapital) - 1.0) * 100;
  const btcHodlCagr = calculateCAGR(initialCapital, finalPerf.btcHodlValue, dates[startIdx], dates[dates.length - 1]) * 100;
  const maxDrawdown = Math.min(...dailyPerformance.map(d => d.drawdown));

  // Sharpe/Sortino (same method as other strategies)
  const dailyReturns = computeReturnsFromValues(dailyPerformance.map(d => d.totalValue));
  const { sharpe: sharpeRatio, sortino: sortinoRatio } = computeSharpeAndSortinoFromReturns(dailyReturns);

  // BTC HODL Sharpe/Sortino computed from BTC HODL daily returns
  const btcDailyReturns = computeReturnsFromValues(dailyPerformance.map(d => d.btcHodlValue));
  const { sharpe: btcHodlSharpeRatio, sortino: btcHodlSortinoRatio } = computeSharpeAndSortinoFromReturns(btcDailyReturns);

  return {
    dailyPerformance,
    trades,
    strategyId: 'smart-btc-dca',
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
      outperformance: cagr - btcHodlCagr,
    },
  };
}

const strategy: Strategy = {
  id: 'smart-btc-dca',
  name: 'Smart DCA',
  run,
  getDefaultParameters: () => ({
    evalIntervalDays: DEFAULT_PARAMETERS.evalIntervalDays.defaultValue,
    baseDcaUsdc: DEFAULT_PARAMETERS.baseDcaUsdc.defaultValue,
    minTradeUsd: DEFAULT_PARAMETERS.minTradeUsd.defaultValue,
    lookbackDays: DEFAULT_PARAMETERS.lookbackDays.defaultValue,
    kKicker: DEFAULT_PARAMETERS.kKicker.defaultValue,
    winsorizeAbsRet: DEFAULT_PARAMETERS.winsorizeAbsRet.defaultValue,
    ewmaLambdaDaily: DEFAULT_PARAMETERS.ewmaLambdaDaily.defaultValue,
    bufferMult: DEFAULT_PARAMETERS.bufferMult.defaultValue,
    cmaxMult: DEFAULT_PARAMETERS.cmaxMult.defaultValue,
    thresholdMode: DEFAULT_PARAMETERS.thresholdMode.defaultValue,
    targetBtcWeight: DEFAULT_PARAMETERS.targetBtcWeight.defaultValue,
    bandDelta: DEFAULT_PARAMETERS.bandDelta.defaultValue,
    rebalanceCapFrac: DEFAULT_PARAMETERS.rebalanceCapFrac.defaultValue,
    tradingFee: DEFAULT_PARAMETERS.tradingFee.defaultValue,
  }),
  getParameterMeta: () => ({ ...DEFAULT_PARAMETERS }),
};

export default strategy;
