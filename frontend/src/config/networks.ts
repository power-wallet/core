import { base, baseSepolia, mainnet, sepolia } from 'viem/chains';
import type { Chain } from 'viem';

export type ChainKey = 'base' | 'base-sepolia' | 'mainnet' | 'sepolia' | 'unknown';

export function getChainKey(chainId?: number): ChainKey {
  if (chainId === 1) return 'mainnet';
  if (chainId === 11155111) return 'sepolia';
  if (chainId === 8453) return 'base';
  if (chainId === 84532) return 'base-sepolia';
  return 'unknown';
}

export function getViemChain(chainId?: number): Chain {
  const key = getChainKey(chainId);
  if (key === 'base') return base;
  if (key === 'base-sepolia') return baseSepolia;
  if (key === 'sepolia') return sepolia;
  return mainnet; // default fallback
}
