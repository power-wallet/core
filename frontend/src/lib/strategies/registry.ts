import type { SimulationResult } from '@/lib/types';

export type StrategyId = 'btc-eth-momentum' | 'smart-btc-dca' | 'simple-btc-dca' | 'btc-trend-following';

export interface Strategy {
  id: StrategyId;
  name: string;
  run: (initialCapital: number, startDate: string, endDate: string) => Promise<SimulationResult>;
}

// Chart identifiers used by StrategyCharts to determine which charts to render
export type ChartId = 'portfolio' | 'powerlaw' | 'allocation' | 'drawdown' | 'prices' | 'rsi' | 'trades';

export const strategyCharts: Record<StrategyId, ChartId[]> = {
  'smart-btc-dca': ['portfolio', 'powerlaw', 'allocation', 'drawdown', 'trades'],
  'simple-btc-dca': ['portfolio', 'prices', 'allocation', 'drawdown', 'trades'],
  'btc-eth-momentum': ['portfolio', 'prices', 'allocation', 'drawdown', 'rsi', 'trades'],
  'btc-trend-following': ['portfolio', 'prices', 'allocation', 'drawdown', 'trades'],
};

// Lazy imports to avoid bundling unused strategies upfront
async function getMomentumStrategy() {
  const mod = await import('@/lib/strategies/btcEthMomentum');
  return mod.default as Strategy;
}

async function getDcaStrategy() {
  const mod = await import('@/lib/strategies/smartBtcDca');
  return mod.default as Strategy;
}

async function getSimpleDcaStrategy() {
  const mod = await import('@/lib/strategies/simpleBtcDca');
  return mod.default as Strategy;
}

async function getTrendFollowingStrategy() {
  const mod = await import('@/lib/strategies/btcTrendFollowing');
  return mod.default as Strategy;
}

export async function runStrategy(
  strategyId: StrategyId,
  initialCapital: number,
  startDate: string,
  endDate: string
): Promise<SimulationResult> {
  switch (strategyId) {
    case 'btc-eth-momentum': {
      const s = await getMomentumStrategy();
      return s.run(initialCapital, startDate, endDate);
    }
    case 'smart-btc-dca': {
      const s = await getDcaStrategy();
      return s.run(initialCapital, startDate, endDate);
    }
    case 'simple-btc-dca': {
      const s = await getSimpleDcaStrategy();
      return s.run(initialCapital, startDate, endDate);
    }
    case 'btc-trend-following': {
      const s = await getTrendFollowingStrategy();
      return s.run(initialCapital, startDate, endDate);
    }
    default:
      throw new Error(`Unknown strategy: ${strategyId}`);
  }
}


