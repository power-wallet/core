import { FEED_ABI } from './abi';
import { createPublicClient, http } from 'viem';
import { getViemChain, getChainKey } from '@/config/networks';
import appConfig from '@/config/appConfig.json';

export async function loadAssetPrices(chainId: number, assets: { symbol: string; feed?: `0x${string}`; decimals: number }[]) {
  const chainKey = getChainKey(chainId);
  const cfg = (appConfig as any)[chainKey];
  const client = createPublicClient({ chain: getViemChain(chainId), transport: http(cfg?.rpcUrl) });
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

// Quick, off-chain fallback using Binance spot prices
export async function loadAssetPricesFromBinance(assets: { symbol: string }[]): Promise<Record<string, { price: number; decimals: number }>> {
  const wantBtc = assets.some(a => ['cbBTC', 'WBTC', 'BTC'].includes(a.symbol));
  const wantEth = assets.some(a => ['WETH', 'ETH'].includes(a.symbol));
  const results: Record<string, { price: number; decimals: number }> = {};
  try {
    const fetches: Promise<void>[] = [];
    if (wantBtc) {
      fetches.push((async () => {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
        if (res.ok) {
          const j = await res.json();
          const p = Number(j?.price);
          if (Number.isFinite(p) && p > 0) {
            results['cbBTC'] = { price: p, decimals: 0 };
            results['BTC'] = { price: p, decimals: 0 };
            results['WBTC'] = { price: p, decimals: 0 };
          }
        }
      })());
    }
    if (wantEth) {
      fetches.push((async () => {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT');
        if (res.ok) {
          const j = await res.json();
          const p = Number(j?.price);
          if (Number.isFinite(p) && p > 0) {
            results['WETH'] = { price: p, decimals: 0 };
            results['ETH'] = { price: p, decimals: 0 };
          }
        }
      })());
    }
    await Promise.all(fetches);
  } catch {}
  // Always include USDC = 1 if requested
  if (assets.some(a => a.symbol === 'USDC')) results['USDC'] = { price: 1, decimals: 6 };
  return results;
}


