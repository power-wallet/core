/**
 * Trading Strategy Simulator
 * Implements the BTC-ETH momentum strategy from Python
 */

import { calculateRSI, calculateSMA, calculateRatio, crossedAbove, crossedBelow } from './indicators';
import { loadPriceData } from '@/lib/priceFeed';
import type { StrategyId } from '@/lib/strategies/registry';
import type { 
  PriceData, 
  SimulationResult, 
  StrategyParameters,
  Position,
  Trade,
  DailyPerformance,
  DailyRsiSignals 
} from './types';

// Default strategy parameters (from Python)
const DEFAULT_PARAMETERS: StrategyParameters = {
  rsiBars: 8,
  ethBtcRsiBars: 5,
  bearishRsiEntry: 65,
  bearishRsiExit: 70,
  bullishRsiEntry: 80,
  bullishRsiExit: 65,
  regimeFilterMaLength: 200,
  allocation: 0.98,
  rebalanceThreshold: 0.275,
  momentumExponent: 3.5,
  tradingFee: 0.0030,
};

/**
 * Load pre-calculated data from Python (with indicators already computed)
 */
export async function loadPythonData(): Promise<any[]> {
  const response = await fetch('/data/backtest_data_with_indicators.json');
  if (!response.ok) {
    throw new Error(`Failed to load Python data: ${response.statusText}`);
  }
  return response.json();
}


/**
 * Calculate CAGR (Compound Annual Growth Rate)
 */
function calculateCAGR(startValue: number, endValue: number, startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const years = days / 365.2425;
  
  if (years < 1) {
    // Annualize for periods less than a year
    return (endValue / startValue - 1.0) * (365.2425 / days);
  }
  
  return Math.pow(endValue / startValue, 1 / years) - 1.0;
}

/**
 * Main simulation function
 */
export async function runSimulation(
  initialCapital: number,
  startDate: string,
  endDate: string,
  parameters: StrategyParameters = DEFAULT_PARAMETERS
): Promise<SimulationResult> {
  // Load data (local JSON + Binance tail) with lookback for indicators
  const { btc: btcData, eth: ethData } = await loadPriceData(startDate, endDate, 210);
  
  // Align ALL data (including lookback) on common dates
  const btcMap = new Map(btcData.map((d: PriceData) => [d.date, d.close] as const));
  const ethMap = new Map(ethData.map((d: PriceData) => [d.date, d.close] as const));
  const commonDates = btcData.filter((d: PriceData) => ethMap.has(d.date)).map((d: PriceData) => d.date).sort();
  
  const allDates = commonDates;
  const allBtcPrices = allDates.map((d: string) => btcMap.get(d)!);
  const allEthPrices = allDates.map((d: string) => ethMap.get(d)!);
  
  // Calculate indicators on ALL data (including lookback period)
  const allBtcRsi = calculateRSI(allBtcPrices, parameters.rsiBars);
  const allEthRsi = calculateRSI(allEthPrices, parameters.rsiBars);
  const allBtcSma = calculateSMA(allBtcPrices, parameters.regimeFilterMaLength);
  const allEthBtcRatio = calculateRatio(allEthPrices, allBtcPrices);
  const allEthBtcRsi = calculateRSI(allEthBtcRatio, parameters.ethBtcRsiBars);
  
  // Now extract just the backtest period
  const dates = allDates;
  const btcPrices = allBtcPrices;
  const ethPrices = allEthPrices;
  const btcRsi = allBtcRsi;
  const ethRsi = allEthRsi;
  const btcSma = allBtcSma;
  const ethBtcRsi = allEthBtcRsi;
  
  // Find start index (after lookback period)
  const startIdx = dates.findIndex(d => d >= startDate);
  if (startIdx === -1) throw new Error('Start date not found in data');
  
  // Initialize portfolio
  let cash = initialCapital;
  const btcPos: Position = { symbol: 'BTC', quantity: 0, value: 0, lastPrice: 0 };
  const ethPos: Position = { symbol: 'ETH', quantity: 0, value: 0, lastPrice: 0 };
  
  // Initialize BTC HODL benchmark
  const btcStartPrice = btcPrices[startIdx];
  const btcHodlQty = (initialCapital * (1.0 - parameters.tradingFee)) / btcStartPrice;
  
  const trades: Trade[] = [];
  const rsiSignals: DailyRsiSignals[] = [];
  const dailyPerformance: DailyPerformance[] = [];
  
  let maxPortfolioValue = initialCapital;
  let maxBtcHodlValue = initialCapital;
  
  // Add initial day performance (before any trading)
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
  
  // Debug: log simulation parameters (optional)
  // if (typeof window !== 'undefined') {
  //   console.log('=== SIMULATION START ===');
  //   console.log('Start date:', dates[startIdx]);
  //   console.log('End date:', dates[dates.length - 1]);
  //   console.log('Total days:', dates.length - startIdx - 1);
  // }
  
  // Simulate day by day (start at startIdx + 1 to match Python logic)
  for (let i = startIdx + 1; i < dates.length; i++) {
    const date = dates[i];
    const btcPrice = btcPrices[i];
    const ethPrice = ethPrices[i];
    
    // Update positions
    btcPos.lastPrice = btcPrice;
    btcPos.value = btcPos.quantity * btcPrice;
    ethPos.lastPrice = ethPrice;
    ethPos.value = ethPos.quantity * ethPrice;
    
    // Determine regime (bullish/bearish)
    const sma = btcSma[i];
    const isBullish = isNaN(sma) ? true : btcPrice > sma;
    
    const rsiEntry = isBullish ? parameters.bullishRsiEntry : parameters.bearishRsiEntry;
    const rsiExit = isBullish ? parameters.bullishRsiExit : parameters.bearishRsiExit;
    
    // Check for entry/exit signals
    const btcRsiNow = btcRsi[i];
    const ethRsiNow = ethRsi[i];
    const btcRsiPrev = i > startIdx ? btcRsi[i - 1] : NaN;
    const ethRsiPrev = i > startIdx ? ethRsi[i - 1] : NaN;
    
    const btcOpen = btcPos.quantity > 0;
    const ethOpen = ethPos.quantity > 0;
    
    // Calculate momentum from ETH/BTC RSI
    const ebRsi = ethBtcRsi[i];
    let ethMom = isNaN(ebRsi) ? 0.5 : (ebRsi / 100.0) + 0.5;
    let btcMom = isNaN(ebRsi) ? 0.5 : (1.0 - (ebRsi / 100.0)) + 0.5;
    
    ethMom = Math.pow(ethMom, parameters.momentumExponent);
    btcMom = Math.pow(btcMom, parameters.momentumExponent);
    
    // Determine target weights
    let wBtc = btcMom;
    let wEth = ethMom;
    
    // Apply entry/exit logic
    if (btcOpen) {
      if (crossedBelow(btcRsiNow, btcRsiPrev, rsiExit)) {
        wBtc = 0;
      }
    } else {
      if (!crossedAbove(btcRsiNow, btcRsiPrev, rsiEntry)) {
        wBtc = 0;
      }
    }
    
    if (ethOpen) {
      if (crossedBelow(ethRsiNow, ethRsiPrev, rsiExit)) {
        wEth = 0;
      }
    } else {
      if (!crossedAbove(ethRsiNow, ethRsiPrev, rsiEntry)) {
        wEth = 0;
      }
    }

    const btcEligible = wBtc > 0;
    const ethEligible = wEth > 0;
    
    // Normalize weights
    const wSum = wBtc + wEth;
    if (wSum > 0) {
      wBtc /= wSum;
      wEth /= wSum;
    }
    
    const totalEquity = cash + btcPos.value + ethPos.value;
    const investable = totalEquity * parameters.allocation;
    const targetBtcValue = investable * wBtc;
    const targetEthValue = investable * wEth;
    
    // Rebalance function
    const rebalance = (pos: Position, targetValue: number, price: number) => {
      const delta = targetValue - pos.value;
      if (Math.abs(delta) < parameters.rebalanceThreshold * totalEquity) {
        return;
      }
      
      let fee = 0;
      if (delta > 0) {
        // Buy
        const totalCost = delta * (1.0 + parameters.tradingFee);
        let actualDelta = delta;
        
        if (totalCost > cash) {
          actualDelta = cash / (1.0 + parameters.tradingFee);
          if (Math.abs(actualDelta) < parameters.rebalanceThreshold * totalEquity) {
            return;
          }
        }
        
        const qty = (actualDelta * (1.0 - parameters.tradingFee)) / price;
        fee = actualDelta * parameters.tradingFee;
        pos.quantity += qty;
        cash -= (actualDelta + fee);
        
        // Update position value immediately
        pos.value = pos.quantity * price;
        pos.lastPrice = price;
        
        const trade = {
          date,
          symbol: pos.symbol,
          side: 'BUY' as const,
          price,
          quantity: qty,
          value: actualDelta,
          fee,
          portfolioValue: cash + btcPos.value + ethPos.value,
        };
        trades.push(trade);
      } else {
        // Sell
        const sellValue = -delta;
        const qty = Math.min(pos.quantity, sellValue / price);
        const actualValue = qty * price;
        fee = actualValue * parameters.tradingFee;
        pos.quantity -= qty;
        cash += actualValue * (1.0 - parameters.tradingFee);
        
        // Update position value immediately
        pos.value = pos.quantity * price;
        pos.lastPrice = price;
        
        const trade = {
          date,
          symbol: pos.symbol,
          side: 'SELL' as const,
          price,
          quantity: qty,
          value: actualValue,
          fee,
          portfolioValue: cash + btcPos.value + ethPos.value,
        };
        trades.push(trade);
      }
    };
    
    // Execute rebalancing
    const preBtcQty = btcPos.quantity;
    const preEthQty = ethPos.quantity;
    rebalance(btcPos, targetBtcValue, btcPrice);
    rebalance(ethPos, targetEthValue, ethPrice);
    
    // Calculate daily performance
    const portfolioValue = cash + btcPos.value + ethPos.value;
    const btcHodlValue = btcHodlQty * btcPrice;
    
    maxPortfolioValue = Math.max(maxPortfolioValue, portfolioValue);
    maxBtcHodlValue = Math.max(maxBtcHodlValue, btcHodlValue);
    
    const drawdown = ((portfolioValue / maxPortfolioValue) - 1.0) * 100;
    const btcHodlDrawdown = ((btcHodlValue / maxBtcHodlValue) - 1.0) * 100;
    
    dailyPerformance.push({
      date,
      cash,
      btcQty: btcPos.quantity,
      ethQty: ethPos.quantity,
      btcValue: btcPos.value,
      ethValue: ethPos.value,
      totalValue: portfolioValue,
      btcHodlValue,
      drawdown,
      btcHodlDrawdown,
      btcPrice,
      ethPrice,
    });

    // Record signals for this day (after trades)
    const btcBought = btcPos.quantity > preBtcQty;
    const btcSold = btcPos.quantity < preBtcQty;
    const ethBought = ethPos.quantity > preEthQty;
    const ethSold = ethPos.quantity < preEthQty;
    const lastBtcTrade = trades.slice().reverse().find(t => t.date === date && t.symbol === 'BTC');
    const lastEthTrade = trades.slice().reverse().find(t => t.date === date && t.symbol === 'ETH');
    const entryLine = isBullish ? rsiEntry : rsiEntry; // same var, explicit
    const exitLine = isBullish ? rsiExit : rsiExit; // same var, explicit
    const bothEligible = btcEligible && ethEligible;
    const bothAllocated = (btcPos.quantity > 0 && ethPos.quantity > 0);
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
  
  // Calculate summary statistics
  const finalPerf = dailyPerformance[dailyPerformance.length - 1];
  const startPerf = dailyPerformance[0];
  
  const totalReturn = ((finalPerf.totalValue / initialCapital) - 1.0) * 100;
  const btcHodlReturn = ((finalPerf.btcHodlValue / initialCapital) - 1.0) * 100;
  
  const cagr = calculateCAGR(initialCapital, finalPerf.totalValue, dates[startIdx], dates[dates.length - 1]) * 100;
  const btcHodlCagr = calculateCAGR(initialCapital, finalPerf.btcHodlValue, dates[startIdx], dates[dates.length - 1]) * 100;
  
  const maxDrawdown = Math.min(...dailyPerformance.map(d => d.drawdown));
  const btcHodlMaxDrawdown = Math.min(...dailyPerformance.map(d => d.btcHodlDrawdown));
  
  // Daily returns (strategy)
  const dailyReturns: number[] = [];
  for (let i = 1; i < dailyPerformance.length; i++) {
    const prev = dailyPerformance[i - 1].totalValue;
    const curr = dailyPerformance[i].totalValue;
    dailyReturns.push((curr / prev) - 1.0);
  }
  // Sharpe (assume risk-free ~ 0 daily), annualize by sqrt(365)
  const meanDaily = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
  const stdDaily = Math.sqrt(
    dailyReturns.reduce((acc, r) => acc + Math.pow(r - meanDaily, 2), 0) / (dailyReturns.length > 1 ? (dailyReturns.length - 1) : 1)
  );
  const sharpeRatio = stdDaily > 0 ? (meanDaily / stdDaily) * Math.sqrt(365) : 0;
  
  // Sortino (downside deviation only)
  const downside = dailyReturns.filter(r => r < 0);
  const meanDown = downside.reduce((a, b) => a + b, 0) / (downside.length || 1);
  const downDev = Math.sqrt(
    downside.reduce((acc, r) => acc + Math.pow(r - meanDown, 2), 0) / (downside.length > 1 ? (downside.length - 1) : 1)
  );
  const sortinoRatio = downDev > 0 ? (meanDaily / downDev) * Math.sqrt(365) : 0;

  // Benchmark daily returns (BTC HODL)
  const btcDailyReturns: number[] = [];
  for (let i = 1; i < dailyPerformance.length; i++) {
    const prev = dailyPerformance[i - 1].btcHodlValue;
    const curr = dailyPerformance[i].btcHodlValue;
    btcDailyReturns.push((curr / prev) - 1.0);
  }
  const btcMeanDaily = btcDailyReturns.reduce((a, b) => a + b, 0) / (btcDailyReturns.length || 1);
  const btcStdDaily = Math.sqrt(
    btcDailyReturns.reduce((acc, r) => acc + Math.pow(r - btcMeanDaily, 2), 0) / (btcDailyReturns.length > 1 ? (btcDailyReturns.length - 1) : 1)
  );
  const btcHodlSharpeRatio = btcStdDaily > 0 ? (btcMeanDaily / btcStdDaily) * Math.sqrt(365) : 0;
  const btcDownside = btcDailyReturns.filter(r => r < 0);
  const btcMeanDown = btcDownside.reduce((a, b) => a + b, 0) / (btcDownside.length || 1);
  const btcDownDev = Math.sqrt(
    btcDownside.reduce((acc, r) => acc + Math.pow(r - btcMeanDown, 2), 0) / (btcDownside.length > 1 ? (btcDownside.length - 1) : 1)
  );
  const btcHodlSortinoRatio = btcDownDev > 0 ? (btcMeanDaily / btcDownDev) * Math.sqrt(365) : 0;
  
  return {
    dailyPerformance,
    trades,
    rsiSignals,
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

export async function runStrategy(
  strategyId: StrategyId,
  initialCapital: number,
  startDate: string,
  endDate: string,
  prices: { btc: PriceData[]; eth: PriceData[] },
  options?: Record<string, any>
): Promise<SimulationResult> {
  switch (strategyId) {
    case 'btc-eth-momentum': {
      const mod = await import('@/lib/strategies/btcEthMomentum');
      const o = options || {};
      return mod.default.run(initialCapital, startDate, endDate, { 
        prices: { 
          btc: prices.btc, 
          eth: prices.eth || [] 
        },
        ...o
      });
    }
    case 'simple-btc-dca': {
      const mod = await import('@/lib/strategies/simpleBtcDca');
      const o = options || {};
      return mod.default.run(initialCapital, startDate, endDate, { prices: { btc: prices.btc }, ...o });
    }
    case 'power-btc-dca': {
      const mod = await import('@/lib/strategies/powerBtcDca');
      const o = options || {};
      // Power accepts snake_case keys already; pass through
      return mod.default.run(initialCapital, startDate, endDate, { prices: { btc: prices.btc }, ...o });
    }
    case 'smart-btc-dca': {
      const mod = await import('@/lib/strategies/smartBtcDca');
      const o = options || {};
      // Smart uses camelCase keys already; pass through
      return mod.default.run(initialCapital, startDate, endDate, { prices: { btc: prices.btc }, ...o });
    }
    case 'trend-btc-dca': {
      const mod = await import('@/lib/strategies/btcTrendFollowing');
      const o = options || {};
      return mod.default.run(initialCapital, startDate, endDate, { prices: { btc: prices.btc }, ...o });
    }
    default:
      throw new Error(`Unknown strategy: ${strategyId}`);
  }
}
