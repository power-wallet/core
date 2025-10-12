import { loadBtcOnly } from '@/lib/priceFeed';
import type { PriceData } from '@/lib/types';
import type { SimulationResult, Trade, DailyPerformance } from '@/lib/types';

export interface Strategy {
  id: 'simple-btc-dca';
  name: string;
  run: (
    initialCapital: number,
    startDate: string,
    endDate: string,
    options: { prices: { btc: PriceData[] } }
  ) => Promise<SimulationResult>;
}

const DCA_AMOUNT = 100; // USDC per buy
const DCA_INTERVAL_DAYS = 7; // weekly

async function run(initialCapital: number, startDate: string, endDate: string, options: { prices: { btc: PriceData[] } }): Promise<SimulationResult> {
  const btcData = options.prices.btc;

  const dates = btcData.map(d => d.date);
  const prices = btcData.map(d => d.close);
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
  let nextBuyDate = toDate(dates[startIdx]);
  nextBuyDate.setDate(nextBuyDate.getDate() + DCA_INTERVAL_DAYS);

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
  });

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const btcPrice = prices[i];

    // DCA buy if due and cash available
    const currDate = toDate(date);
    if (usdc >= DCA_AMOUNT && currDate >= nextBuyDate) {
      const buyAmount = Math.min(DCA_AMOUNT, usdc);
      const fee = buyAmount * 0.003;
      const qty = (buyAmount * (1.0 - 0.003)) / btcPrice;
      btcQty += qty; usdc -= (buyAmount + fee);
      trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: buyAmount, fee, portfolioValue: usdc + btcQty * btcPrice });
      nextBuyDate.setDate(nextBuyDate.getDate() + DCA_INTERVAL_DAYS);
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
    });
  }

  const finalPerf = dailyPerformance[dailyPerformance.length - 1];
  const totalReturn = ((finalPerf.totalValue / initialCapital) - 1.0) * 100;
  // CAGR utility copied from smartBtcDca
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

  // Risk metrics (Sharpe/Sortino) same approach as smartBtcDca
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

  // BTC HODL risk metrics (Sharpe/Sortino)
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
    strategyId: 'simple-btc-dca',
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
  id: 'simple-btc-dca',
  name: 'Simple BTC DCA',
  run,
};

export default strategy;


