import type { PriceData } from '@/lib/types';
import type { SimulationResult, Trade, DailyPerformance } from '@/lib/types';
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

// Power law model: P(t) = C * d^n, with d = days since 2009-01-03
const C = 9.65e-18; // 9.65 × 10^-18
const N = 5.845;

// Centralized default parameters for the strategy
export const DEFAULT_PARAMETERS = {
  tradingFee: 0.003,                  // 0.3% fee assumption
  tradeIntervalDays: 7,               // evaluate weekly
  usdcReserveFrac: 0.02,              // keep 2% USDC reserve
  btcReserveFrac: 0.10,               // keep 10% BTC reserve
  buyPctBelowLower: 0.05,             // buy 5% of available USDC below lower band
  buyPctBetweenLowerAndModel: 0.01,   // buy 1% between lower band and model
  sellPctAboveUpper: 0.05,            // sell 5% of BTC above upper band
  upperBandMult: 2.0,                 // upper band = model * 2
  lowerBandMult: 0.5,                 // lower band = model * 0.5
};

function daysSinceGenesis(dateStr: string): number {
  const genesis = new Date('2009-01-03T00:00:00Z').getTime();
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  const days = Math.floor((d - genesis) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

function modelPriceUSD(dateStr: string): number {
  const d = daysSinceGenesis(dateStr);
  return C * Math.pow(d, N);
}

function calculateCAGR(startValue: number, endValue: number, startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const years = days / 365.2425;
  if (years < 1) { return (endValue / startValue - 1.0) * (365.2425 / days); }
  return Math.pow(endValue / startValue, 1 / years) - 1.0;
}

export async function run(initialCapital: number, startDate: string, endDate: string, options: {
  prices: { btc: PriceData[] };
  tradingFee?: number;
  tradeIntervalDays?: number;
  usdcReserveFrac?: number;
  btcReserveFrac?: number;
  buyPctBelowLower?: number;
  buyPctBetweenLowerAndModel?: number;
  sellPctAboveUpper?: number;
  upperBandMult?: number;
  lowerBandMult?: number;
}): Promise<SimulationResult> {
  const btcData = options.prices.btc;
  const tradingFee = options.tradingFee ?? DEFAULT_PARAMETERS.tradingFee;
  const tradeIntervalDays = Math.max(1, Math.floor(options.tradeIntervalDays ?? DEFAULT_PARAMETERS.tradeIntervalDays));
  const usdcReserveFrac = Math.max(0, options.usdcReserveFrac ?? DEFAULT_PARAMETERS.usdcReserveFrac);
  const btcReserveFrac = Math.max(0, options.btcReserveFrac ?? DEFAULT_PARAMETERS.btcReserveFrac);
  const buyPctBelowLower = Math.max(0, options.buyPctBelowLower ?? DEFAULT_PARAMETERS.buyPctBelowLower);
  const buyPctBetweenLowerAndModel = Math.max(0, options.buyPctBetweenLowerAndModel ?? DEFAULT_PARAMETERS.buyPctBetweenLowerAndModel);
  const sellPctAboveUpper = Math.max(0, options.sellPctAboveUpper ?? DEFAULT_PARAMETERS.sellPctAboveUpper);
  const upperMult = Math.max(0, options.upperBandMult ?? DEFAULT_PARAMETERS.upperBandMult);
  const lowerMult = Math.max(0, options.lowerBandMult ?? DEFAULT_PARAMETERS.lowerBandMult);

  // Align to range and compute model and bands
  const dates = btcData.map(d => d.date);
  const prices = btcData.map(d => d.close);

  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in BTC data');

  // Portfolio: USDC + BTC only
  let usdc = initialCapital;
  let btcQty = 0;
  const trades: Trade[] = [];
  const dailyPerformance: DailyPerformance[] = [];

  // Benchmark HODL BTC
  const btcStartPrice = prices[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - tradingFee)) / btcStartPrice; // reuse fee assumption

  let maxPortfolioValue = initialCapital;
  let maxBtcHodlValue = initialCapital;

  // Helper: is week boundary (trade once per 7 days)
  const shouldTradeOnIndex = (i: number): boolean => {
    if (i <= startIdx) return false;
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    // Trade if at least configured days since last trade index tracked
    return diffDays >= tradeIntervalDays;
  };

  let lastTradeIndex = startIdx;

  // Initial perf day
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
    btcModel: modelPriceUSD(dates[startIdx]),
    btcUpperBand: modelPriceUSD(dates[startIdx]) * upperMult,
    btcLowerBand: modelPriceUSD(dates[startIdx]) * lowerMult,
  });

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const btcPrice = prices[i];
    const model = modelPriceUSD(date);
    const upper = model * upperMult;
    const lower = model * lowerMult;

    // Update portfolio value
    const btcValue = btcQty * btcPrice;
    const totalEquity = usdc + btcValue;

    // Trading rule (evaluated on configured cadence)
    let traded = false;
    if ((i - lastTradeIndex) >= tradeIntervalDays || shouldTradeOnIndex(i)) {
      // Keep configured reserves
      const usdcSpendable = Math.max(0, totalEquity * (1 - usdcReserveFrac) - btcValue);
      const btcSpendableQty = Math.max(0, btcQty - (totalEquity * btcReserveFrac) / btcPrice);

      if (btcPrice < lower && usdc > 0) {
        // BUY configured % of available USDC when below lower band
        const buyAmount = Math.min(usdc * buyPctBelowLower, usdcSpendable);
        if (buyAmount > 0) {
          const fee = buyAmount * tradingFee;
          const qty = (buyAmount * (1.0 - tradingFee)) / btcPrice;
          btcQty += qty; usdc -= (buyAmount + fee);
          trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: buyAmount, fee, portfolioValue: usdc + btcQty * btcPrice });
          traded = true; lastTradeIndex = i;
        }
      } else if (btcPrice >= lower && btcPrice <= model && usdc > 0) {
        // BUY configured % when between lower band and model price (small DCA)
        const buyAmount = Math.min(usdc * buyPctBetweenLowerAndModel, usdcSpendable);
        if (buyAmount > 0) {
          const fee = buyAmount * tradingFee;
          const qty = (buyAmount * (1.0 - tradingFee)) / btcPrice;
          btcQty += qty; usdc -= (buyAmount + fee);
          trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: buyAmount, fee, portfolioValue: usdc + btcQty * btcPrice });
          traded = true; lastTradeIndex = i;
        }
      } else if (btcPrice > upper && btcQty > 0) {
        // SELL configured % of available BTC
        const qtyToSell = Math.min(btcQty * sellPctAboveUpper, btcSpendableQty);
        if (qtyToSell > 0) {
          const gross = qtyToSell * btcPrice;
          const fee = gross * tradingFee;
          btcQty -= qtyToSell; usdc += gross * (1.0 - tradingFee);
          trades.push({ date, symbol: 'BTC', side: 'SELL', price: btcPrice, quantity: qtyToSell, value: gross, fee, portfolioValue: usdc + btcQty * btcPrice });
          traded = true; lastTradeIndex = i;
        }
      }
    }

    const newBtcValue = btcQty * btcPrice;
    const portfolioValue = usdc + newBtcValue;
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
      btcValue: newBtcValue,
      ethValue: 0,
      totalValue: portfolioValue,
      btcHodlValue,
      drawdown,
      btcHodlDrawdown,
      btcPrice,
      ethPrice: 0,
      btcModel: model,
      btcUpperBand: upper,
      btcLowerBand: lower,
    });
  }

  const finalPerf = dailyPerformance[dailyPerformance.length - 1];
  const totalReturn = ((finalPerf.totalValue / initialCapital) - 1.0) * 100;
  const cagr = calculateCAGR(initialCapital, finalPerf.totalValue, dates[startIdx], dates[dates.length - 1]) * 100;
  const btcHodlReturn = ((finalPerf.btcHodlValue / initialCapital) - 1.0) * 100;
  const btcHodlCagr = calculateCAGR(initialCapital, finalPerf.btcHodlValue, dates[startIdx], dates[dates.length - 1]) * 100;
  const maxDrawdown = Math.min(...dailyPerformance.map(d => d.drawdown));
  const btcHodlMaxDrawdown = Math.min(...dailyPerformance.map(d => d.btcHodlDrawdown));

  // Risk metrics
  const dailyReturns = computeReturnsFromValues(dailyPerformance.map(d => d.totalValue));
  const { sharpe: sharpeRatio, sortino: sortinoRatio } = computeSharpeAndSortinoFromReturns(dailyReturns);

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
      btcHodlMaxDrawdown,
      btcHodlSharpeRatio,
      btcHodlSortinoRatio,
      outperformance: cagr - btcHodlCagr,
    },
  };
}

const strategy: Strategy = {
  id: 'power-btc-dca',
  name: 'Power BTC DCA',
  run,
};

export default strategy;
