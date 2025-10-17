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
}

const DEFAULT_PARAMETERS: StrategyParameters = {
  rsi_bars: 8,
  eth_btc_rsi_bars: 5,
  bearish_rsi_entry: 65,
  bearish_rsi_exit: 70,
  bullish_rsi_entry: 80,
  bullish_rsi_exit: 65,
  regime_filter_ma_length: 200,
  allocation: 0.98,
  rebalance_threshold: 0.275,
  momentum_exponent: 3.5,
  trading_fee: 0.0030,
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
    rsi_bars?: number;
    eth_btc_rsi_bars?: number;
    bearish_rsi_entry?: number;
    bearish_rsi_exit?: number;
    bullish_rsi_entry?: number;
    bullish_rsi_exit?: number;
    regime_filter_ma_length?: number;
    allocation?: number;
    rebalance_threshold?: number;
    momentum_exponent?: number;
    trading_fee?: number;
  }
): Promise<SimulationResult> {
  const parameters: StrategyParameters = {
    rsi_bars: Math.max(1, Math.floor(options.rsi_bars ?? DEFAULT_PARAMETERS.rsi_bars)),
    eth_btc_rsi_bars: Math.max(1, Math.floor(options.eth_btc_rsi_bars ?? DEFAULT_PARAMETERS.eth_btc_rsi_bars)),
    bearish_rsi_entry: options.bearish_rsi_entry ?? DEFAULT_PARAMETERS.bearish_rsi_entry,
    bearish_rsi_exit: options.bearish_rsi_exit ?? DEFAULT_PARAMETERS.bearish_rsi_exit,
    bullish_rsi_entry: options.bullish_rsi_entry ?? DEFAULT_PARAMETERS.bullish_rsi_entry,
    bullish_rsi_exit: options.bullish_rsi_exit ?? DEFAULT_PARAMETERS.bullish_rsi_exit,
    regime_filter_ma_length: Math.max(1, Math.floor(options.regime_filter_ma_length ?? DEFAULT_PARAMETERS.regime_filter_ma_length)),
    allocation: Math.min(1, Math.max(0, options.allocation ?? DEFAULT_PARAMETERS.allocation)),
    rebalance_threshold: Math.max(0, options.rebalance_threshold ?? DEFAULT_PARAMETERS.rebalance_threshold),
    momentum_exponent: Math.max(0, options.momentum_exponent ?? DEFAULT_PARAMETERS.momentum_exponent),
    trading_fee: Math.max(0, options.trading_fee ?? DEFAULT_PARAMETERS.trading_fee),
  };
  const { btc: btcData = [], eth: ethData = [] } = options.prices;

  const btcMap = new Map(btcData.map(d => [d.date, d.close] as const));
  const ethMap = new Map(ethData.map(d => [d.date, d.close] as const));
  const commonDates = btcData.filter(d => ethMap.has(d.date)).map(d => d.date).sort();

  const dates = commonDates;
  const btcPrices = dates.map(d => btcMap.get(d)!);
  const ethPrices = dates.map(d => ethMap.get(d)!);

  const btcRsi = calculateRSI(btcPrices, parameters.rsi_bars);
  const ethRsi = calculateRSI(ethPrices, parameters.rsi_bars);
  const btcSma = calculateSMA(btcPrices, parameters.regime_filter_ma_length);
  const ethBtcRatio = calculateRatio(ethPrices, btcPrices);
  const ethBtcRsi = calculateRSI(ethBtcRatio, parameters.eth_btc_rsi_bars);

  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in data');

  let cash = initialCapital;
  const btcPos: Position = { symbol: 'BTC', quantity: 0, value: 0, lastPrice: 0 };
  const ethPos: Position = { symbol: 'ETH', quantity: 0, value: 0, lastPrice: 0 };

  const btcStartPrice = btcPrices[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - parameters.trading_fee)) / btcStartPrice;

  const trades: Trade[] = [];
  const rsiSignals: DailyRsiSignals[] = [];
  const dailyPerformance: DailyPerformance[] = [];

  let maxPortfolioValue = initialCapital;
  let maxBtcHodlValue = initialCapital;

  dailyPerformance.push({
    date: dates[startIdx],
    cash: initialCapital,
    btcQty: 0,
    ethQty: 0,
    btcValue: 0,
    ethValue: 0,
    totalValue: initialCapital,
    btcHodlValue: initialCapital,
    drawdown: 0,
    btcHodlDrawdown: 0,
    btcPrice: btcPrices[startIdx],
    ethPrice: ethPrices[startIdx],
  });

  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const btcPrice = btcPrices[i];
    const ethPrice = ethPrices[i];

    btcPos.lastPrice = btcPrice; btcPos.value = btcPos.quantity * btcPrice;
    ethPos.lastPrice = ethPrice; ethPos.value = ethPos.quantity * ethPrice;

    const sma = btcSma[i];
    const isBullish = isNaN(sma) ? true : btcPrice > sma;
    const rsiEntry = isBullish ? parameters.bullish_rsi_entry : parameters.bearish_rsi_entry;
    const rsiExit = isBullish ? parameters.bullish_rsi_exit : parameters.bearish_rsi_exit;

    const btcRsiNow = btcRsi[i];
    const ethRsiNow = ethRsi[i];
    const btcRsiPrev = i > startIdx ? btcRsi[i - 1] : NaN;
    const ethRsiPrev = i > startIdx ? ethRsi[i - 1] : NaN;

    const btcOpen = btcPos.quantity > 0;
    const ethOpen = ethPos.quantity > 0;

    const ebRsi = ethBtcRsi[i];
    let ethMom = isNaN(ebRsi) ? 0.5 : (ebRsi / 100.0) + 0.5;
    let btcMom = isNaN(ebRsi) ? 0.5 : (1.0 - (ebRsi / 100.0)) + 0.5;
    ethMom = Math.pow(ethMom, parameters.momentum_exponent);
    btcMom = Math.pow(btcMom, parameters.momentum_exponent);

    let wBtc = btcMom; let wEth = ethMom;
    if (btcOpen) { if (crossedBelow(btcRsiNow, btcRsiPrev, rsiExit)) { wBtc = 0; } } else { if (!crossedAbove(btcRsiNow, btcRsiPrev, rsiEntry)) { wBtc = 0; } }
    if (ethOpen) { if (crossedBelow(ethRsiNow, ethRsiPrev, rsiExit)) { wEth = 0; } } else { if (!crossedAbove(ethRsiNow, ethRsiPrev, rsiEntry)) { wEth = 0; } }

    const btcEligible = wBtc > 0; const ethEligible = wEth > 0;
    const wSum = wBtc + wEth; if (wSum > 0) { wBtc /= wSum; wEth /= wSum; }

    const totalEquity = cash + btcPos.value + ethPos.value;
    const investable = totalEquity * parameters.allocation;
    const targetBtcValue = investable * wBtc; const targetEthValue = investable * wEth;

    const rebalance = (pos: Position, targetValue: number, price: number) => {
      const delta = targetValue - pos.value;
      if (Math.abs(delta) < parameters.rebalance_threshold * totalEquity) { return; }
      let fee = 0;
      if (delta > 0) {
        const totalCost = delta * (1.0 + parameters.trading_fee);
        let actualDelta = delta;
        if (totalCost > cash) {
          actualDelta = cash / (1.0 + parameters.trading_fee);
          if (Math.abs(actualDelta) < parameters.rebalance_threshold * totalEquity) { return; }
        }
        const qty = (actualDelta * (1.0 - parameters.trading_fee)) / price;
        fee = actualDelta * parameters.trading_fee;
        pos.quantity += qty; cash -= (actualDelta + fee);
        pos.value = pos.quantity * price; pos.lastPrice = price;
        trades.push({ date, symbol: pos.symbol, side: 'BUY', price, quantity: qty, value: actualDelta, fee, portfolioValue: cash + btcPos.value + ethPos.value });
      } else {
        const sellValue = -delta; const qty = Math.min(pos.quantity, sellValue / price);
        const actualValue = qty * price; fee = actualValue * parameters.trading_fee;
        pos.quantity -= qty; cash += actualValue * (1.0 - parameters.trading_fee);
        pos.value = pos.quantity * price; pos.lastPrice = price;
        trades.push({ date, symbol: pos.symbol, side: 'SELL', price, quantity: qty, value: actualValue, fee, portfolioValue: cash + btcPos.value + ethPos.value });
      }
    };

    const preBtcQty = btcPos.quantity; const preEthQty = ethPos.quantity;
    rebalance(btcPos, targetBtcValue, btcPrice);
    rebalance(ethPos, targetEthValue, ethPrice);

    const portfolioValue = cash + btcPos.value + ethPos.value;
    const btcHodlValue = btcHodlQty * btcPrice;
    maxPortfolioValue = Math.max(maxPortfolioValue, portfolioValue);
    maxBtcHodlValue = Math.max(maxBtcHodlValue, btcHodlValue);
    const drawdown = ((portfolioValue / maxPortfolioValue) - 1.0) * 100;
    const btcHodlDrawdown = ((btcHodlValue / maxBtcHodlValue) - 1.0) * 100;

    dailyPerformance.push({ date, cash, btcQty: btcPos.quantity, ethQty: ethPos.quantity, btcValue: btcPos.value, ethValue: ethPos.value, totalValue: portfolioValue, btcHodlValue, drawdown, btcHodlDrawdown, btcPrice, ethPrice });

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
};

export default strategy;


