import { FEED_ABI } from './abi';
import { createPublicClient, http } from 'viem';
import { getViemChain } from '@/config/networks';

export async function loadAssetPrices(chainId: number, assets: { symbol: string; feed?: `0x${string}`; decimals: number }[]) {
  const client = createPublicClient({ chain: getViemChain(chainId), transport: http() });
  const next: Record<string, { price: number; decimals: number }> = {};
  for (const m of assets) {
    if (m.symbol === 'USDC') { next['USDC'] = { price: 1, decimals: 6 }; continue; }
    const feed = m.feed as `0x${string}` | undefined;
    if (!feed) continue;
    const dec = await client.readContract({ address: feed, abi: FEED_ABI as any, functionName: 'decimals', args: [] }) as number;
    const round = await client.readContract({ address: feed, abi: FEED_ABI as any, functionName: 'latestRoundData', args: [] }) as any;
    const price = Number(round[1]) / 10 ** dec;
    next[m.symbol] = { price, decimals: dec };
  }
  return next;
}


