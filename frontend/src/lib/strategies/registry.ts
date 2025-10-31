import type { SimulationResult, PriceData } from '@/lib/types';

export type StrategyId = 'btc-eth-momentum' | 'smart-btc-dca' | 'simple-btc-dca' | 'trend-btc-dca' | 'power-btc-dca';

export interface Strategy {
  id: StrategyId;
  name: string;
  run: (
    initialCapital: number,
    startDate: string,
    endDate: string,
    options: { prices: { btc?: PriceData[]; eth?: PriceData[] } }
  ) => Promise<SimulationResult>;
  getDefaultParameters: () => Record<string, any>;
}

// Chart identifiers used by StrategyCharts to determine which charts to render
export type ChartId = 'portfolio' | 'powerlaw' | 'allocation' | 'drawdown' | 'prices' | 'rsi' | 'trades' | 'assetvalue';

export const strategyCharts: Record<StrategyId, ChartId[]> = {
  'simple-btc-dca': ['portfolio', 'prices', 'assetvalue', 'allocation', 'drawdown', 'trades'],
  'power-btc-dca': ['portfolio', 'powerlaw', 'assetvalue', 'allocation', 'drawdown', 'trades'],
  'smart-btc-dca': ['portfolio', 'prices', 'assetvalue', 'allocation', 'drawdown', 'trades'],
  'trend-btc-dca': ['portfolio', 'prices', 'assetvalue', 'allocation', 'drawdown', 'trades'],
  'btc-eth-momentum': ['portfolio', 'prices', 'assetvalue', 'allocation', 'drawdown', 'rsi', 'trades'],
};

// Lazy imports to avoid bundling unused strategies upfront
async function getMomentumStrategy() {
  const mod = await import('@/lib/strategies/btcEthMomentum');
  return mod.default as Strategy;
}

async function getDcaStrategy() {
  const mod = await import('@/lib/strategies/powerBtcDca');
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

async function getPowerDcaStrategy() {
  const mod = await import('@/lib/strategies/smartBtcDca');
  return mod.default as Strategy;
}

// runStrategy moved to lib/simulator.ts

export async function loadStrategy(id: StrategyId): Promise<Strategy> {
  switch (id) {
    case 'btc-eth-momentum':
      return await getMomentumStrategy();
    case 'simple-btc-dca':
      return await getSimpleDcaStrategy();
    case 'power-btc-dca':
      return await getDcaStrategy();
    case 'smart-btc-dca':
      return await getPowerDcaStrategy();
    case 'trend-btc-dca':
      return await getTrendFollowingStrategy();
    default:
      throw new Error(`Unknown strategy id: ${id}`);
  }
}


