/**
 * Trading Strategy Simulator
 * Implements the BTC-ETH momentum strategy from Python
 */

import { calculateRSI, calculateSMA, calculateRatio, crossedAbove, crossedBelow } from './indicators';
import type { 
  PriceData, 
  SimulationResult, 
  StrategyParameters,
  Position,
  Trade,
  DailyPerformance 
} from './types';

// Default strategy parameters (from Python)
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
 * Fetch price data from Binance API (matching Python logic)
 */
async function fetchBinanceKlines(symbol: string, interval: string, startMs: number, endMs: number): Promise<PriceData[]> {
  const limit = 1000;
  const allData: PriceData[] = [];
  let currentStartMs = startMs;
  
  while (currentStartMs < endMs) {
    const params = new URLSearchParams({
      symbol,
      interval,
      limit: limit.toString(),
      startTime: currentStartMs.toString(),
      endTime: endMs.toString(),
    });
    
    const response = await fetch(`https://api.binance.com/api/v3/klines?${params}`);
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) break;
    
    // Binance kline format: [open_time, open, high, low, close, volume, close_time, ...]
    for (const candle of data) {
      const closeTime = new Date(candle[6]); // close_time in ms
      const closePrice = parseFloat(candle[4]); // close price
      const dateStr = closeTime.toISOString().split('T')[0]; // YYYY-MM-DD
      
      allData.push({
        date: dateStr,
        close: closePrice,
      });
    }
    
    // Move cursor to after last candle
    const lastCloseTime = data[data.length - 1][6];
    currentStartMs = lastCloseTime + 1;
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Remove duplicates and sort by date
  const uniqueData = Array.from(
    new Map(allData.map(item => [item.date, item])).values()
  ).sort((a, b) => a.date.localeCompare(b.date));
  
  return uniqueData;
}

/**
 * Load price data from Binance API (matching Python logic)
 */
export async function loadPriceData(
  startDate: string,
  endDate: string,
  lookbackDays: number = 210
): Promise<{ btc: PriceData[], eth: PriceData[] }> {
  const start = new Date(startDate);
  const lookbackStart = new Date(start);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);
  
  const startMs = lookbackStart.getTime();
  const endMs = new Date(endDate).getTime();
  
  const [btc, eth] = await Promise.all([
    fetchBinanceKlines('BTCUSDT', '1d', startMs, endMs),
    fetchBinanceKlines('ETHUSDT', '1d', startMs, endMs),
  ]);
  
  return { btc, eth };
}

/**
 * Filter price data by date range
 */
function filterByDateRange(
  btcData: PriceData[],
  ethData: PriceData[],
  startDate: string,
  endDate: string,
  lookbackDays: number = 200
): { btc: PriceData[], eth: PriceData[] } {
  // Calculate lookback start date
  const start = new Date(startDate);
  const lookbackStart = new Date(start);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays);
  const lookbackStartStr = lookbackStart.toISOString().split('T')[0];
  
  // Filter data
  const btc = btcData.filter(d => d.date >= lookbackStartStr && d.date <= endDate);
  const eth = ethData.filter(d => d.date >= lookbackStartStr && d.date <= endDate);
  
  return { btc, eth };
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
  // Load data from Binance (with lookback for indicators)
  const { btc: btcData, eth: ethData } = await loadPriceData(startDate, endDate, 210);
  
  // Align ALL data (including lookback) on common dates
  const btcMap = new Map(btcData.map(d => [d.date, d.close]));
  const ethMap = new Map(ethData.map(d => [d.date, d.close]));
  const commonDates = btcData.filter(d => ethMap.has(d.date)).map(d => d.date).sort();
  
  const allDates = commonDates;
  const allBtcPrices = allDates.map(d => btcMap.get(d)!);
  const allEthPrices = allDates.map(d => ethMap.get(d)!);
  
  // Calculate indicators on ALL data (including lookback period)
  const allBtcRsi = calculateRSI(allBtcPrices, parameters.rsi_bars);
  const allEthRsi = calculateRSI(allEthPrices, parameters.rsi_bars);
  const allBtcSma = calculateSMA(allBtcPrices, parameters.regime_filter_ma_length);
  const allEthBtcRatio = calculateRatio(allEthPrices, allBtcPrices);
  const allEthBtcRsi = calculateRSI(allEthBtcRatio, parameters.eth_btc_rsi_bars);
  
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
  const btcHodlQty = (initialCapital * (1.0 - parameters.trading_fee)) / btcStartPrice;
  
  const trades: Trade[] = [];
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
    
    const rsiEntry = isBullish ? parameters.bullish_rsi_entry : parameters.bearish_rsi_entry;
    const rsiExit = isBullish ? parameters.bullish_rsi_exit : parameters.bearish_rsi_exit;
    
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
    
    ethMom = Math.pow(ethMom, parameters.momentum_exponent);
    btcMom = Math.pow(btcMom, parameters.momentum_exponent);
    
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
      if (Math.abs(delta) < parameters.rebalance_threshold * totalEquity) {
        return;
      }
      
      let fee = 0;
      if (delta > 0) {
        // Buy
        const totalCost = delta * (1.0 + parameters.trading_fee);
        let actualDelta = delta;
        
        if (totalCost > cash) {
          actualDelta = cash / (1.0 + parameters.trading_fee);
          if (Math.abs(actualDelta) < parameters.rebalance_threshold * totalEquity) {
            return;
          }
        }
        
        const qty = (actualDelta * (1.0 - parameters.trading_fee)) / price;
        fee = actualDelta * parameters.trading_fee;
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
        fee = actualValue * parameters.trading_fee;
        pos.quantity -= qty;
        cash += actualValue * (1.0 - parameters.trading_fee);
        
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
