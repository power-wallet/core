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

export async function run(initialCapital: number, startDate: string, endDate: string, options: { prices: { btc: PriceData[] } }): Promise<SimulationResult> {
  const btcData = options.prices.btc;

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
  const btcHodlQty = (initialCapital * (1.0 - 0.003)) / btcStartPrice; // reuse 0.3% fee assumption

  let maxPortfolioValue = initialCapital;
  let maxBtcHodlValue = initialCapital;

  // Helper: is week boundary (trade once per 7 days)
  const shouldTradeOnIndex = (i: number): boolean => {
    if (i <= startIdx) return false;
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    // Trade if at least 7 days since last trade index tracked
    return diffDays >= 7;
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
    btcUpperBand: modelPriceUSD(dates[startIdx]) * 2,
    btcLowerBand: modelPriceUSD(dates[startIdx]) * 0.5,
  });

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const btcPrice = prices[i];
    const model = modelPriceUSD(date);
    const upper = model * 2;
    const lower = model * 0.5;

    // Update portfolio value
    const btcValue = btcQty * btcPrice;
    const totalEquity = usdc + btcValue;

    // Weekly trading rule
    let traded = false;
    if ((i - lastTradeIndex) >= 7 || shouldTradeOnIndex(i)) {
      // Keep 2% USDC reserve, 10% BTC reserve
      const usdcSpendable = Math.max(0, totalEquity * 0.98 - btcValue);
      const btcSpendableQty = Math.max(0, btcQty - (totalEquity * 0.10) / btcPrice);

      if (btcPrice < lower && usdc > 0) {
        // BUY 5% of available USDC when below lower band
        const buyAmount = Math.min(usdc * 0.05, usdcSpendable);
        if (buyAmount > 0) {
          const fee = buyAmount * 0.003;
          const qty = (buyAmount * (1.0 - 0.003)) / btcPrice;
          btcQty += qty; usdc -= (buyAmount + fee);
          trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: buyAmount, fee, portfolioValue: usdc + btcQty * btcPrice });
          traded = true; lastTradeIndex = i;
        }
      } else if (btcPrice >= lower && btcPrice <= model && usdc > 0) {
        // BUY 1% of available USDC when between lower band and model price (small DCA)
        const buyAmount = Math.min(usdc * 0.01, usdcSpendable);
        if (buyAmount > 0) {
          const fee = buyAmount * 0.003;
          const qty = (buyAmount * (1.0 - 0.003)) / btcPrice;
          btcQty += qty; usdc -= (buyAmount + fee);
          trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: buyAmount, fee, portfolioValue: usdc + btcQty * btcPrice });
          traded = true; lastTradeIndex = i;
        }
      } else if (btcPrice > upper && btcQty > 0) {
        // SELL 5% of available BTC
        const qtyToSell = Math.min(btcQty * 0.05, btcSpendableQty);
        if (qtyToSell > 0) {
          const gross = qtyToSell * btcPrice;
          const fee = gross * 0.003;
          btcQty -= qtyToSell; usdc += gross * (1.0 - 0.003);
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
