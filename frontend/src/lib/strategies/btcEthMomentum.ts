import { calculateRSI, calculateSMA, calculateRatio, crossedAbove, crossedBelow } from '@/lib/indicators';
import { loadPriceData } from '@/lib/priceFeed';
import type { PriceData } from '@/lib/types';
import type { SimulationResult, StrategyParameters, Position, Trade, DailyPerformance, DailyRsiSignals } from '@/lib/types';
import { computeReturnsFromValues, computeSharpeAndSortinoFromReturns } from '@/lib/stats';

export interface Strategy {
  id: 'btc-eth-momentum';
  name: string;
  run: (
    initialCapital: number,
    startDate: string,
    endDate: string,
    options: { prices: { btc?: PriceData[]; eth?: PriceData[] } }
  ) => Promise<SimulationResult>;
  getDefaultParameters: () => Record<string, any>;
  getParameterMeta: () => Record<string, any>;
}

export const DEFAULT_PARAMETERS = {
  evalIntervalDays: {
    name: 'Interval (days)',
    defaultValue: 1,
    type: 'days',
    description: 'Strategy evaluation interval (daily default)',
    configurable: true,
  },
  rsiBars: {
    name: 'RSI (days)',
    defaultValue: 8,
    type: 'days',
    description: 'RSI (days) for BTC/USDC and ETH/USDC',
    configurable: true,
  },
  ethBtcRsiBars: {
    name: 'ETH/BTC RSI (days)',
    defaultValue: 5,
    type: 'days',
    description: 'RSI (days) for ETH/BTC price ratio',
    configurable: true,
  },
  bearishRsiEntry: {
    name: 'Bearish entry RSI',
    defaultValue: 65,
    type: 'number',
    description: 'Entry RSI threshold in bear regime (cross above to enter)',
    configurable: true,
  },
  bearishRsiExit: {
    name: 'Bearish exit RSI',
    defaultValue: 70,
    type: 'number',
    description: 'Exit RSI threshold in bear regime (cross below to exit)',
    configurable: true,
  },
  bullishRsiEntry: {
    name: 'Bullish entry RSI',
    defaultValue: 80,
    type: 'number',
    description: 'Entry RSI threshold in bull regime (cross above to enter)',
    configurable: true,
  },
  bullishRsiExit: {
    name: 'Bullish exit RSI',
    defaultValue: 65,
    type: 'number',
    description: 'Exit RSI threshold in bull regime (cross below to exit)',
    configurable: true,
  },
  regimeFilterMaLength: {
    name: 'Regime SMA length (days)',
    defaultValue: 200,
    type: 'days',
    description: 'BTC SMA length (days) to define bull/bear regime',
    configurable: true,
  },
  allocation: {
    name: 'Investable allocation',
    defaultValue: 0.98,
    minPerc: 1,
    maxPerc: 100,
    percInc: 1,
    type: 'percentage',
    description: 'Fraction of equity investable in risk assets (rest kept as cash)',
    configurable: true,
  },
  rebalanceThreshold: {
    name: 'Rebalance threshold (NAV %)',
    defaultValue: 0.275,
    minPerc: 5,
    maxPerc: 50,
    percInc: 0.5,
    type: 'percentage',
    description: 'Min |target-current| as fraction of total equity to trigger a trade',
    configurable: true,
  },
  momentumExponent: {
    name: 'Momentum exponent',
    defaultValue: 3.5,
    type: 'number',
    description: 'Nonlinearity applied to ETH/BTC momentum weights',
    configurable: true,
  },
  tradingFee: {
    name: 'Fee (%)',
    defaultValue: 0.003,
    minPerc: 0,
    maxPerc: 0.5,
    percInc: 0.05,
    type: 'percentage',
    description: 'Per-trade fee (0.30%) applied to buys and sells',
    configurable: true,
  },
};

function calculateCAGR(startValue: number, endValue: number, startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const years = days / 365.2425;
  if (years < 1) {
    return (endValue / startValue - 1.0) * (365.2425 / days);
  }
  return Math.pow(endValue / startValue, 1 / years) - 1.0;
}

export async function run(
  initialCapital: number,
  startDate: string,
  endDate: string,
  options: {
    prices: { btc?: PriceData[]; eth?: PriceData[] };
    // Momentum strategy parameters (camelCase to match other strategies)
    evalIntervalDays?: number;
    rsiBars?: number;
    ethBtcRsiBars?: number;
    bearishRsiEntry?: number;
    bearishRsiExit?: number;
    bullishRsiEntry?: number;
    bullishRsiExit?: number;
    regimeFilterMaLength?: number;
    allocation?: number;
    rebalanceThreshold?: number;
    momentumExponent?: number;
    tradingFee?: number;
    depositAmount?: number;
    depositIntervalDays?: number;
  }
): Promise<SimulationResult> {
  const parameters: StrategyParameters = {
    rsiBars: Math.max(1, Math.floor(options.rsiBars ?? DEFAULT_PARAMETERS.rsiBars.defaultValue)),
    ethBtcRsiBars: Math.max(1, Math.floor(options.ethBtcRsiBars ?? DEFAULT_PARAMETERS.ethBtcRsiBars.defaultValue)),
    bearishRsiEntry: options.bearishRsiEntry ?? DEFAULT_PARAMETERS.bearishRsiEntry.defaultValue,
    bearishRsiExit: options.bearishRsiExit ?? DEFAULT_PARAMETERS.bearishRsiExit.defaultValue,
    bullishRsiEntry: options.bullishRsiEntry ?? DEFAULT_PARAMETERS.bullishRsiEntry.defaultValue,
    bullishRsiExit: options.bullishRsiExit ?? DEFAULT_PARAMETERS.bullishRsiExit.defaultValue,
    regimeFilterMaLength: Math.max(1, Math.floor(options.regimeFilterMaLength ?? DEFAULT_PARAMETERS.regimeFilterMaLength.defaultValue)),
    allocation: Math.min(1, Math.max(0, options.allocation ?? DEFAULT_PARAMETERS.allocation.defaultValue)),
    rebalanceThreshold: Math.max(0, options.rebalanceThreshold ?? DEFAULT_PARAMETERS.rebalanceThreshold.defaultValue),
    momentumExponent: Math.max(0, options.momentumExponent ?? DEFAULT_PARAMETERS.momentumExponent.defaultValue),
    tradingFee: Math.max(0, options.tradingFee ?? DEFAULT_PARAMETERS.tradingFee.defaultValue),
  };
  const evalIntervalDays = Math.max(1, Math.floor(options.evalIntervalDays ?? DEFAULT_PARAMETERS.evalIntervalDays.defaultValue));
  const { btc: btcData = [], eth: ethData = [] } = options.prices;

  const btcMap = new Map(btcData.map(d => [d.date, d.close] as const));
  const ethMap = new Map(ethData.map(d => [d.date, d.close] as const));
  const commonDates = btcData.filter(d => ethMap.has(d.date)).map(d => d.date).sort();

  const dates = commonDates;
  const btcPrices = dates.map(d => btcMap.get(d)!);
  const ethPrices = dates.map(d => ethMap.get(d)!);

  const btcRsi = calculateRSI(btcPrices, parameters.rsiBars);
  const ethRsi = calculateRSI(ethPrices, parameters.rsiBars);
  const btcSma = calculateSMA(btcPrices, parameters.regimeFilterMaLength);
  const ethBtcRatio = calculateRatio(ethPrices, btcPrices);
  const ethBtcRsi = calculateRSI(ethBtcRatio, parameters.ethBtcRsiBars);

  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in data');

  const depositAmount = Math.max(0, options.depositAmount ?? 0);
  const depositIntervalDays = Math.max(0, Math.floor(options.depositIntervalDays ?? 0));
  // initialCapital is total contributions; start with first deposit as cash
  let usdc = depositAmount > 0 ? depositAmount : 0;
  const btcPos: Position = { symbol: 'BTC', quantity: 0, value: 0, lastPrice: 0 };
  const ethPos: Position = { symbol: 'ETH', quantity: 0, value: 0, lastPrice: 0 };

  const btcStartPrice = btcPrices[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - parameters.tradingFee)) / btcStartPrice;

  const trades: Trade[] = [];
  const rsiSignals: DailyRsiSignals[] = [];
  const dailyPerformance: DailyPerformance[] = [];

  let maxPortfolioValue = usdc;
  let maxBtcHodlValue = initialCapital;

  console.log("initialCapital", initialCapital, "depositAmount", depositAmount, "usdc", usdc);
  console.log("btcHodlQty", btcHodlQty, "btcStartPrice", btcStartPrice);
  console.log("startDate", startDate, "endDate", endDate);
  console.log("btc prices start", btcPrices[startIdx], "date", dates[startIdx]);
  console.log("eth prices start", ethPrices[startIdx], "date", dates[startIdx]);
  console.log("btc prices end", btcPrices[dates.length - 1], "date", dates[dates.length - 1]);
  console.log("eth prices end", ethPrices[dates.length - 1], "date", dates[dates.length - 1]);

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
    btcPrice: btcPrices[startIdx],
    ethPrice: ethPrices[startIdx],
  });

  // Deposit schedule
  const toDate = (s: string) => new Date(s + 'T00:00:00Z');
  let nextDepositDate = toDate(dates[startIdx]);
  if (depositIntervalDays > 0) {
    nextDepositDate.setDate(nextDepositDate.getDate() + depositIntervalDays);
  }
  // Evaluation cadence
  let nextEvalDate = toDate(dates[startIdx]);
  nextEvalDate.setDate(nextEvalDate.getDate() + evalIntervalDays);

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const btcPrice = btcPrices[i];
    const ethPrice = ethPrices[i];

    // Apply deposit before evaluation
    const currDate = toDate(date);
    if (depositAmount > 0 && depositIntervalDays > 0 && currDate >= nextDepositDate) {
      usdc += depositAmount;
      nextDepositDate.setDate(nextDepositDate.getDate() + depositIntervalDays);
    }

    btcPos.lastPrice = btcPrice; btcPos.value = btcPos.quantity * btcPrice;
    ethPos.lastPrice = ethPrice; ethPos.value = ethPos.quantity * ethPrice;

    const sma = btcSma[i];
    const isBullish = isNaN(sma) ? true : btcPrice > sma;
    const rsiEntry = isBullish ? parameters.bullishRsiEntry : parameters.bearishRsiEntry;
    const rsiExit = isBullish ? parameters.bullishRsiExit : parameters.bearishRsiExit;

    const btcRsiNow = btcRsi[i];
    const ethRsiNow = ethRsi[i];
    const btcRsiPrev = i > startIdx ? btcRsi[i - 1] : NaN;
    const ethRsiPrev = i > startIdx ? ethRsi[i - 1] : NaN;

    const btcOpen = btcPos.quantity > 0;
    const ethOpen = ethPos.quantity > 0;

    const ebRsi = ethBtcRsi[i];
    let ethMom = isNaN(ebRsi) ? 0.5 : (ebRsi / 100.0) + 0.5;
    let btcMom = isNaN(ebRsi) ? 0.5 : (1.0 - (ebRsi / 100.0)) + 0.5;
    ethMom = Math.pow(ethMom, parameters.momentumExponent);
    btcMom = Math.pow(btcMom, parameters.momentumExponent);

    let wBtc = btcMom; let wEth = ethMom;
    if (btcOpen) { if (crossedBelow(btcRsiNow, btcRsiPrev, rsiExit)) { wBtc = 0; } } else { if (!crossedAbove(btcRsiNow, btcRsiPrev, rsiEntry)) { wBtc = 0; } }
    if (ethOpen) { if (crossedBelow(ethRsiNow, ethRsiPrev, rsiExit)) { wEth = 0; } } else { if (!crossedAbove(ethRsiNow, ethRsiPrev, rsiEntry)) { wEth = 0; } }

    const btcEligible = wBtc > 0; const ethEligible = wEth > 0;
    const wSum = wBtc + wEth; if (wSum > 0) { wBtc /= wSum; wEth /= wSum; }

    const totalEquity = usdc + btcPos.value + ethPos.value;
    const investable = totalEquity * parameters.allocation;
    const targetBtcValue = investable * wBtc; const targetEthValue = investable * wEth;

    const rebalance = (pos: Position, targetValue: number, price: number) => {
      const delta = targetValue - pos.value;
      if (Math.abs(delta) < parameters.rebalanceThreshold * totalEquity) { return; }
      let fee = 0;
      if (delta > 0) {
        const totalCost = delta * (1.0 + parameters.tradingFee);
        let actualDelta = delta;
        if (totalCost > usdc) {
          actualDelta = usdc / (1.0 + parameters.tradingFee);
          if (Math.abs(actualDelta) < parameters.rebalanceThreshold * totalEquity) { return; }
        }
        const qty = (actualDelta * (1.0 - parameters.tradingFee)) / price;
        fee = actualDelta * parameters.tradingFee;
        pos.quantity += qty; usdc -= (actualDelta + fee);
        pos.value = pos.quantity * price; pos.lastPrice = price;
        trades.push({ date, symbol: pos.symbol, side: 'BUY', price, quantity: qty, value: actualDelta, fee, portfolioValue: usdc + btcPos.value + ethPos.value });
      } else {
        const sellValue = -delta; const qty = Math.min(pos.quantity, sellValue / price);
        const actualValue = qty * price; fee = actualValue * parameters.tradingFee;
        pos.quantity -= qty; usdc += actualValue * (1.0 - parameters.tradingFee);
        pos.value = pos.quantity * price; pos.lastPrice = price;
        trades.push({ date, symbol: pos.symbol, side: 'SELL', price, quantity: qty, value: actualValue, fee, portfolioValue: usdc + btcPos.value + ethPos.value });
      }
    };

    const preBtcQty = btcPos.quantity; const preEthQty = ethPos.quantity;
    if (currDate >= nextEvalDate) {
      rebalance(btcPos, targetBtcValue, btcPrice);
      rebalance(ethPos, targetEthValue, ethPrice);
      nextEvalDate.setDate(nextEvalDate.getDate() + evalIntervalDays);
    }

    const portfolioValue = usdc + btcPos.value + ethPos.value;
    const btcHodlValue = btcHodlQty * btcPrice;
    maxPortfolioValue = Math.max(maxPortfolioValue, portfolioValue);
    maxBtcHodlValue = Math.max(maxBtcHodlValue, btcHodlValue);
    const drawdown = ((portfolioValue / maxPortfolioValue) - 1.0) * 100;
    const btcHodlDrawdown = ((btcHodlValue / maxBtcHodlValue) - 1.0) * 100;

    dailyPerformance.push({ date, cash: usdc, btcQty: btcPos.quantity, ethQty: ethPos.quantity, btcValue: btcPos.value, ethValue: ethPos.value, totalValue: portfolioValue, btcHodlValue, drawdown, btcHodlDrawdown, btcPrice, ethPrice });

    const btcBought = btcPos.quantity > preBtcQty; const btcSold = btcPos.quantity < preBtcQty;
    const ethBought = ethPos.quantity > preEthQty; const ethSold = ethPos.quantity < preEthQty;
    const lastBtcTrade = trades.slice().reverse().find(t => t.date === date && t.symbol === 'BTC');
    const lastEthTrade = trades.slice().reverse().find(t => t.date === date && t.symbol === 'ETH');
    const entryLine = isBullish ? rsiEntry : rsiEntry; const exitLine = isBullish ? rsiExit : rsiExit;
    const bothEligible = btcEligible && ethEligible; const bothAllocated = (btcPos.quantity > 0 && ethPos.quantity > 0);
    rsiSignals.push({
      date,
      btcRsi: isNaN(btcRsiNow) ? 0 : btcRsiNow,
      ethRsi: isNaN(ethRsiNow) ? 0 : ethRsiNow,
      entryLine,
      exitLine,
      btcBuy: btcBought,
      btcSell: btcSold,
      ethBuy: ethBought,
      ethSell: ethSold,
      bothEligible,
      bothAllocated,
      btcBuyDetail: lastBtcTrade && lastBtcTrade.side === 'BUY' ? `BUY ${lastBtcTrade.quantity.toFixed(4)} BTC @ $${lastBtcTrade.price.toLocaleString()}` : undefined,
      btcSellDetail: lastBtcTrade && lastBtcTrade.side === 'SELL' ? `SELL ${lastBtcTrade.quantity.toFixed(4)} BTC @ $${lastBtcTrade.price.toLocaleString()}` : undefined,
      ethBuyDetail: lastEthTrade && lastEthTrade.side === 'BUY' ? `BUY ${lastEthTrade.quantity.toFixed(4)} ETH @ $${lastEthTrade.price.toLocaleString()}` : undefined,
      ethSellDetail: lastEthTrade && lastEthTrade.side === 'SELL' ? `SELL ${lastEthTrade.quantity.toFixed(4)} ETH @ $${lastEthTrade.price.toLocaleString()}` : undefined,
    });
  }

  const finalPerf = dailyPerformance[dailyPerformance.length - 1];
  const totalReturn = ((finalPerf.totalValue / initialCapital) - 1.0) * 100;
  const cagr = calculateCAGR(initialCapital, finalPerf.totalValue, dates[startIdx], dates[dates.length - 1]) * 100;
  const btcHodlReturn = ((finalPerf.btcHodlValue / initialCapital) - 1.0) * 100;
  const btcHodlCagr = calculateCAGR(initialCapital, finalPerf.btcHodlValue, dates[startIdx], dates[dates.length - 1]) * 100;
  const maxDrawdown = Math.min(...dailyPerformance.map(d => d.drawdown));
  const btcHodlMaxDrawdown = Math.min(...dailyPerformance.map(d => d.btcHodlDrawdown));

  const dailyReturns = computeReturnsFromValues(dailyPerformance.map(d => d.totalValue));
  const { sharpe: sharpeRatio, sortino: sortinoRatio } = computeSharpeAndSortinoFromReturns(dailyReturns);

  const btcDailyReturns = computeReturnsFromValues(dailyPerformance.map(d => d.btcHodlValue));
  const { sharpe: btcHodlSharpeRatio, sortino: btcHodlSortinoRatio } = computeSharpeAndSortinoFromReturns(btcDailyReturns);

  return {
    dailyPerformance,
    trades,
    rsiSignals,
    strategyId: 'btc-eth-momentum',
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
  id: 'btc-eth-momentum',
  name: 'BTC-ETH Momentum RSI',
  run,
  getDefaultParameters: () => ({
    evalIntervalDays: DEFAULT_PARAMETERS.evalIntervalDays.defaultValue,
    rsiBars: DEFAULT_PARAMETERS.rsiBars.defaultValue,
    ethBtcRsiBars: DEFAULT_PARAMETERS.ethBtcRsiBars.defaultValue,
    bearishRsiEntry: DEFAULT_PARAMETERS.bearishRsiEntry.defaultValue,
    bearishRsiExit: DEFAULT_PARAMETERS.bearishRsiExit.defaultValue,
    bullishRsiEntry: DEFAULT_PARAMETERS.bullishRsiEntry.defaultValue,
    bullishRsiExit: DEFAULT_PARAMETERS.bullishRsiExit.defaultValue,
    regimeFilterMaLength: DEFAULT_PARAMETERS.regimeFilterMaLength.defaultValue,
    allocation: DEFAULT_PARAMETERS.allocation.defaultValue,
    rebalanceThreshold: DEFAULT_PARAMETERS.rebalanceThreshold.defaultValue,
    momentumExponent: DEFAULT_PARAMETERS.momentumExponent.defaultValue,
    tradingFee: DEFAULT_PARAMETERS.tradingFee.defaultValue,
  }),
  getParameterMeta: () => ({ ...DEFAULT_PARAMETERS }),
};

export default strategy;


