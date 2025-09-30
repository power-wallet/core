/**
 * Technical Indicators Library
 * Port of Python indicator calculations for the simulator
 */

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(prices: number[], period: number): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      result.push(sum / period);
    }
  }
  
  return result;
}

/**
 * Calculate Relative Strength Index (RSI)
 * Uses standard Wilder's smoothing method
 */
export function calculateRSI(prices: number[], period: number): number[] {
  const result: number[] = [];
  
  if (prices.length < period + 1) {
    return prices.map(() => NaN);
  }
  
  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  // Separate gains and losses
  const gains: number[] = changes.map(c => c > 0 ? c : 0);
  const losses: number[] = changes.map(c => c < 0 ? -c : 0);
  
  // Calculate initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // First RSI value
  result.push(NaN); // First price has no change
  
  for (let i = 0; i < period; i++) {
    result.push(NaN); // Not enough data yet
  }
  
  // Calculate first RSI
  const rs = avgGain / (avgLoss || 1e-10);
  const rsi = 100 - (100 / (1 + rs));
  result.push(rsi);
  
  // Calculate subsequent RSI values using Wilder's smoothing
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    
    const rs = avgGain / (avgLoss || 1e-10);
    const rsi = 100 - (100 / (1 + rs));
    result.push(rsi);
  }
  
  return result;
}

/**
 * Calculate ETH/BTC ratio
 */
export function calculateRatio(ethPrices: number[], btcPrices: number[]): number[] {
  return ethPrices.map((eth, i) => eth / btcPrices[i]);
}

/**
 * Check if a value crossed above a threshold
 */
export function crossedAbove(current: number, previous: number, threshold: number): boolean {
  if (isNaN(current) || isNaN(previous)) return false;
  return current >= threshold && previous < threshold;
}

/**
 * Check if a value crossed below a threshold
 */
export function crossedBelow(current: number, previous: number, threshold: number): boolean {
  if (isNaN(current) || isNaN(previous)) return false;
  return current < threshold && previous >= threshold;
}
