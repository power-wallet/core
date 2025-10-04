import { base, baseSepolia } from 'viem/chains';
import type { Chain } from 'viem';

export type ChainKey = 'base' | 'base-sepolia';

export function getChainKey(chainId?: number): ChainKey {
  if (chainId === 8453) return 'base';
  if (chainId === 84532) return 'base-sepolia';
  throw new Error('Chain not supported');
}

export function getViemChain(chainId?: number): Chain {
  const key = getChainKey(chainId);
  return key === 'base' ? base : baseSepolia;
}
