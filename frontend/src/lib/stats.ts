export function computeReturnsFromValues(values: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const curr = values[i];
    if (!isFinite(prev) || prev === 0 || !isFinite(curr)) {
      returns.push(0);
      continue;
    }
    returns.push((curr / prev) - 1.0); // (curr − prev) / prev = (curr/prev) − 1
  }
  return returns;
}

export function computeSharpeAndSortinoFromReturns(returns: number[]): { sharpe: number; sortino: number } {
  if (!returns.length) return { sharpe: 0, sortino: 0 };
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.length > 1
    ? returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (returns.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(365) : 0;

  const downside = returns.filter(r => r < 0);
  const meanDown = downside.length ? downside.reduce((a, b) => a + b, 0) / downside.length : 0;
  const downVar = downside.length > 1
    ? downside.reduce((acc, r) => acc + Math.pow(r - meanDown, 2), 0) / (downside.length - 1)
    : 0;
  const downDev = Math.sqrt(downVar);
  const sortino = downDev > 0 ? (mean / downDev) * Math.sqrt(365) : 0;

  return { sharpe, sortino };
}

export function computeSharpeAndSortinoFromValues(values: number[]): { sharpe: number; sortino: number } {
  const returns = computeReturnsFromValues(values);
  return computeSharpeAndSortinoFromReturns(returns);
}


