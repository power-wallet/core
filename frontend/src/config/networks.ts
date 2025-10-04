export type ChainKey = 'base' | 'base-sepolia';

export function getChainKey(chainId?: number): ChainKey {
  if (chainId === 8453) return 'base';
  if (chainId === 84532) return 'base-sepolia';
  throw new Error('Chain not supported');
}
