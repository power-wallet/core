import type { SimulationResult, Trade, DailyPerformance, PriceData } from '@/lib/types';
import { computeReturnsFromValues, computeSharpeAndSortinoFromReturns } from '@/lib/stats';

export interface Strategy {
  id: 'power-btc-dca';
  name: string;
  run: (
    initialCapital: number,
    startDate: string,
    endDate: string,
    options: { prices: { btc: PriceData[] } }
  ) => Promise<SimulationResult>;
}

// Defaults adapted from adaptive_dca_btc.py
const DEFAULTS = {
  lookbackDays: 30,           // rolling realized variance window
  ewmaLambdaDaily: 0.94,      // EWMA lambda
  baseDcaUsdc: 50.0,          // daily base DCA
  targetBtcWeight: 0.70,      // target BTC weight
  bandDelta: 0.10,            // ±10% band around target
  kKicker: 0.05,              // vol/drawdown sizing coefficient
  cmaxMult: 3.0,              // cap extra buy per day = cmax_mult * base_dca
  bufferMult: 9.0,            // days of base DCA to keep as USDC buffer
  minTradeUsd: 1.0,           // minimum trade to execute/record
  winsorizeAbsRet: 0.20,      // clip abs daily log return
  thresholdMode: false,       // optional true threshold rebalancing
  rebalanceCapFrac: 0.25,     // cap single rebalance to 25% NAV
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
  options: { prices: { btc: PriceData[] } }
): Promise<SimulationResult> {
  const btcData = options.prices.btc;
  const dates = btcData.map(d => d.date);
  const closes = btcData.map(d => d.close);
  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in BTC data');

  // Portfolio state
  let usdc = initialCapital;
  let btcQty = 0;

  // Benchmark HODL
  const btcStartPrice = closes[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - 0.003)) / btcStartPrice;

  const trades: Trade[] = [];
  const dailyPerformance: DailyPerformance[] = [];

  // Rolling realized variance buffer and EWMA variance
  const buf: number[] = [];
  let sumR2 = 0.0;
  let ewmaSigma2 = 0.0;
  const warmup: number[] = [];

  // Buffer target (USDC)
  const bufferTarget = DEFAULTS.bufferMult * DEFAULTS.baseDcaUsdc;

  // Running peak for drawdown
  let runningPeak = closes[startIdx];
  let prevClose: number | null = null;

  // Initial day perf
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
    btcPrice: closes[startIdx],
    ethPrice: 0,
  });

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const price = closes[i];

    // Update drawdown
    runningPeak = Math.max(runningPeak, price);
    const drawdown = runningPeak > 0 ? Math.max(0, 1.0 - price / runningPeak) : 0;

    // Daily return (log), winsorized
    let r = 0;
    if (prevClose != null && prevClose > 0) {
      r = Math.log(price / prevClose);
      const w = DEFAULTS.winsorizeAbsRet;
      if (r > w) r = w; else if (r < -w) r = -w;
    }
    prevClose = price;

    // Rolling RV update over lookbackDays
    const r2 = r * r;
    if (buf.length === DEFAULTS.lookbackDays) {
      sumR2 -= buf[0];
      buf.shift();
    }
    buf.push(r2);
    sumR2 += r2;

    // EWMA update (after brief warmup)
    if (warmup.length < Math.min(10, Math.floor(DEFAULTS.lookbackDays / 3))) {
      warmup.push(r2);
      if (warmup.length === Math.min(10, Math.floor(DEFAULTS.lookbackDays / 3))) {
        ewmaSigma2 = warmup.reduce((a, b) => a + b, 0) / warmup.length;
      }
    } else {
      const lam = DEFAULTS.ewmaLambdaDaily;
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

    const wMinus = Math.max(0, DEFAULTS.targetBtcWeight - DEFAULTS.bandDelta);
    const wPlus = Math.min(1, DEFAULTS.targetBtcWeight + DEFAULTS.bandDelta);

    // Threshold-mode optional rebalancing to band boundary
    if (DEFAULTS.thresholdMode && nav > 0) {
      if (wBtc > wPlus) {
        const targetBtcValue = wPlus * nav;
        const excessUsd = Math.max(0, btcValue - targetBtcValue);
        let tradeUsd = Math.min(excessUsd, DEFAULTS.rebalanceCapFrac * nav);
        if (tradeUsd >= DEFAULTS.minTradeUsd && price > 0) {
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
        const tradeUsd = Math.min(shortfallUsd, usdc, DEFAULTS.rebalanceCapFrac * nav);
        if (tradeUsd >= DEFAULTS.minTradeUsd && price > 0) {
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
        const dd = nav > 0 ? ((portfolioValue / Math.max(portfolioValue, 1e-9)) - 1.0) * 100 : 0;
        const hodlPeak = Math.max(btcHodlValue, btcHodlQty * price); // simplistic
        const hodlDD = ((btcHodlValue / Math.max(hodlPeak, 1e-9)) - 1.0) * 100;
        dailyPerformance.push({ date, cash: usdc, btcQty, ethQty: 0, btcValue: btcQty * price, ethValue: 0, totalValue: portfolioValue, btcHodlValue, drawdown: dd, btcHodlDrawdown: hodlDD, btcPrice: price, ethPrice: 0 });
        continue;
      }
    }

    // Buy-only logic (base DCA + volatility kicker)
    const availableToSpend = Math.max(0, usdc - bufferTarget);
    const baseBuy = Math.min(DEFAULTS.baseDcaUsdc, usdc);
    let buyBudget = baseBuy;
    // Kicker scaled by volatility and drawdown
    let extraBuy = DEFAULTS.kKicker * sigmaAnn * drawdown * nav;
    const extraCap = DEFAULTS.cmaxMult * DEFAULTS.baseDcaUsdc;
    extraBuy = Math.min(extraBuy, extraCap);
    extraBuy = Math.min(extraBuy, availableToSpend);
    buyBudget += Math.max(0, extraBuy);

    const buyUsd = Math.min(usdc, buyBudget);
    if (buyUsd >= DEFAULTS.minTradeUsd && price > 0) {
      const qty = buyUsd / price;
      btcQty += qty;
      usdc -= buyUsd;
      trades.push({ date, symbol: 'BTC', side: 'BUY', price, quantity: qty, value: buyUsd, fee: 0, portfolioValue: usdc + btcQty * price });
    }

    // Daily performance
    const portfolioValue = usdc + btcQty * price;
    const btcHodlValue = btcHodlQty * price;
    // Track drawdown vs max value reached so far
    // Maintain maxPortfolio inside loop
    if ((dailyPerformance as any)._max === undefined) (dailyPerformance as any)._max = initialCapital;
    (dailyPerformance as any)._max = Math.max((dailyPerformance as any)._max, portfolioValue);
    const maxPortfolio = (dailyPerformance as any)._max as number;
    const maxHodl = Math.max(...dailyPerformance.map(d => d.btcHodlValue), initialCapital);
    const dd = ((portfolioValue / maxPortfolio) - 1.0) * 100;
    const hodlDD = ((btcHodlValue / maxHodl) - 1.0) * 100;
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
    strategyId: 'power-btc-dca',
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
  id: 'power-btc-dca',
  name: 'Power BTC DCA (Adaptive)',
  run,
};

export default strategy;


