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
 * Calculate RMA (Wilder's Moving Average) - matches pandas_ta implementation
 */
function calculateRMA(values: number[], period: number): number[] {
  const alpha = 1.0 / period;
  const rma: number[] = new Array(values.length).fill(NaN);
  
  // Find first non-NaN index
  let firstValidIdx = 0;
  while (firstValidIdx < values.length && isNaN(values[firstValidIdx])) {
    firstValidIdx++;
  }
  
  if (values.length - firstValidIdx < period) {
    return rma;
  }
  
  // Calculate initial SMA for the first RMA value (starting from first valid index)
  let sum = 0;
  for (let i = firstValidIdx; i < firstValidIdx + period; i++) {
    sum += values[i];
  }
  rma[firstValidIdx + period - 1] = sum / period;
  
  // Apply EWM formula: rma[i] = alpha * value[i] + (1 - alpha) * rma[i-1]
  for (let i = firstValidIdx + period; i < values.length; i++) {
    rma[i] = alpha * values[i] + (1 - alpha) * rma[i - 1];
  }
  
  return rma;
}

/**
 * Calculate RSI - exactly matches pandas_ta implementation
 */
export function calculateRSI(prices: number[], period: number): number[] {
  const rsi: number[] = [];
  
  if (prices.length < period + 1) {
    return prices.map(() => NaN);
  }
  
  // Calculate price changes (diff with drift=1)
  const changes: number[] = [NaN]; // First element is NaN (no previous price)
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  // Separate into positive and negative series
  const positive = changes.map(c => isNaN(c) ? NaN : (c > 0 ? c : 0));
  const negative = changes.map(c => isNaN(c) ? NaN : (c < 0 ? -c : 0));
  
  // Calculate RMA for positive and negative
  const positiveAvg = calculateRMA(positive, period);
  const negativeAvg = calculateRMA(negative, period);
  
  // Calculate RSI
  for (let i = 0; i < prices.length; i++) {
    if (isNaN(positiveAvg[i]) || isNaN(negativeAvg[i])) {
      rsi.push(NaN);
    } else if (negativeAvg[i] === 0) {
      rsi.push(100);
    } else {
      rsi.push(100 * positiveAvg[i] / (positiveAvg[i] + negativeAvg[i]));
    }
  }
  
  return rsi;
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
  return current < threshold && previous > threshold;
}
