import { loadBtcOnly } from '@/lib/priceFeed';
import type { PriceData } from '@/lib/types';
import type { SimulationResult, Trade, DailyPerformance } from '@/lib/types';
import { computeReturnsFromValues, computeSharpeAndSortinoFromReturns } from '@/lib/stats';

export interface Strategy {
  id: 'simple-btc-dca';
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

// Centralized default parameters for the strategy
export const DEFAULT_PARAMETERS = {
  dcaAmount: {
    name: 'DCA amount (USDC)',
    defaultValue: 100,
    type: 'number',
    description: 'USDC per buy',
    configurable: true,
  },
  dcaIntervalDays: {
    name: 'DCA interval (days)',
    defaultValue: 7,
    type: 'days',
    description: 'Strategy evaluation interval (default weekly)',
    configurable: true,
  },
  tradingFee: {
    name: 'Fee (%)',
    defaultValue: 0.003,
    minPerc: 0,
    maxPerc: 1,
    percInc: 0.05,
    type: 'percentage',
    description: 'Trading fee (default 0.3%)',
    configurable: true,
  },
};

export async function run(initialCapital: number, startDate: string, endDate: string, options: { prices: { btc: PriceData[] }; dcaAmount?: number; dcaIntervalDays?: number; tradingFee?: number; depositAmount?: number; depositIntervalDays?: number }): Promise<SimulationResult> {
  const btcData = options.prices.btc;
  const dcaAmount = Math.max(0, options.dcaAmount ?? DEFAULT_PARAMETERS.dcaAmount.defaultValue);
  const dcaIntervalDays = Math.max(1, Math.floor(options.dcaIntervalDays ?? DEFAULT_PARAMETERS.dcaIntervalDays.defaultValue));
  const feePct = options.tradingFee ?? DEFAULT_PARAMETERS.tradingFee.defaultValue;
  const depositAmount = Math.max(0, options.depositAmount ?? 0);
  const depositIntervalDays = Math.max(0, Math.floor(options.depositIntervalDays ?? 0));

  const dates = btcData.map(d => d.date);
  const prices = btcData.map(d => d.close);
  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in BTC data');

  // Treat initialCapital as total contributions; start with only the first deposit as cash
  let usdc = depositAmount > 0 ? depositAmount : 0;
  let btcQty = 0;
  const trades: Trade[] = [];
  const dailyPerformance: DailyPerformance[] = [];

  // Benchmark HODL BTC
  const btcStartPrice = prices[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - feePct)) / btcStartPrice;

  let maxPortfolioValue = usdc;
  let maxBtcHodlValue = initialCapital;

  const toDate = (s: string) => new Date(s + 'T00:00:00Z');
  let nextBuyDate = toDate(dates[startIdx]);
  nextBuyDate.setDate(nextBuyDate.getDate() + dcaIntervalDays);
  // Deposit schedule (start on day 1)
  let nextDepositDate = toDate(dates[startIdx]);
  if (depositIntervalDays > 0) {
    nextDepositDate.setDate(nextDepositDate.getDate() + depositIntervalDays);
  }

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
  });

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const btcPrice = prices[i];

    // Apply deposit if due (before evaluation/trade)
    const currDate = toDate(date);
    if (depositAmount > 0 && depositIntervalDays > 0 && currDate >= nextDepositDate) {
      usdc += depositAmount;
      nextDepositDate.setDate(nextDepositDate.getDate() + depositIntervalDays);
    }

    // DCA buy if due and cash available
    if (usdc >= dcaAmount && currDate >= nextBuyDate) {
      const buyAmount = Math.min(dcaAmount, usdc);
      const fee = buyAmount * feePct;
      const qty = (buyAmount * (1.0 - feePct)) / btcPrice;
      btcQty += qty; usdc -= (buyAmount + fee);
      trades.push({ date, symbol: 'BTC', side: 'BUY', price: btcPrice, quantity: qty, value: buyAmount, fee, portfolioValue: usdc + btcQty * btcPrice });
      nextBuyDate.setDate(nextBuyDate.getDate() + dcaIntervalDays);
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
  const dailyReturns = computeReturnsFromValues(dailyPerformance.map(d => d.totalValue));
  const { sharpe: sharpeRatio, sortino: sortinoRatio } = computeSharpeAndSortinoFromReturns(dailyReturns);

  // BTC HODL risk metrics (Sharpe/Sortino)
  const btcDailyReturns = computeReturnsFromValues(dailyPerformance.map(d => d.btcHodlValue));
  const { sharpe: btcHodlSharpeRatio, sortino: btcHodlSortinoRatio } = computeSharpeAndSortinoFromReturns(btcDailyReturns);

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
  name: 'Simple DCA',
  run,
  getDefaultParameters: () => ({
    dcaAmount: DEFAULT_PARAMETERS.dcaAmount.defaultValue,
    dcaIntervalDays: DEFAULT_PARAMETERS.dcaIntervalDays.defaultValue,
    tradingFee: DEFAULT_PARAMETERS.tradingFee.defaultValue,
  }),
  getParameterMeta: () => ({ ...DEFAULT_PARAMETERS }),
};

export default strategy;


