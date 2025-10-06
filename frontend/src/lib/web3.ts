'use client';

import { baseSepolia, base } from 'wagmi/chains';
import type { Chain } from 'viem';

export const SUPPORTED_CHAINS: Chain[] = [baseSepolia, base];
export const PRIMARY_APP_CHAIN = baseSepolia;

export function getFriendlyChainName(chainId?: number): string {
  if (!chainId) return '';
  if (Number(chainId) === 1) return 'Ethereum mainnet';
  if (Number(chainId) === 8453) return 'Base';
  if (Number(chainId) === 84532) return 'Base Sepolia';
  return `Chain ${chainId}`;
}

export function isSupportedChain(chainId?: number): boolean {
  if (!chainId) return false;
  return SUPPORTED_CHAINS.some((c) => c.id === Number(chainId));
}

export function isOnPrimaryAppChain(chainId?: number): boolean {
  return Number(chainId) === PRIMARY_APP_CHAIN.id;
}

export async function switchOrAddPrimaryChain(
  switchChainAsync: (args: any) => Promise<any>
) {
  try {
    await switchChainAsync({ chainId: PRIMARY_APP_CHAIN.id });
    return true;
  } catch (_) {
    try {
      const params = {
        chainId: `0x${PRIMARY_APP_CHAIN.id.toString(16)}`,
        chainName: PRIMARY_APP_CHAIN.name,
        nativeCurrency: PRIMARY_APP_CHAIN.nativeCurrency,
        rpcUrls: [PRIMARY_APP_CHAIN.rpcUrls.default.http[0]],
        blockExplorerUrls: [PRIMARY_APP_CHAIN.blockExplorers?.default.url || ''],
      } as const;
      await (window as any)?.ethereum?.request({ method: 'wallet_addEthereumChain', params: [params] });
      await switchChainAsync({ chainId: PRIMARY_APP_CHAIN.id });
      return true;
    } catch {
      return false;
    }
  }
}

export async function ensureOnPrimaryChain(chainId?: number, switchChainAsync?: (args: any) => Promise<any>): Promise<boolean> {
  if (isOnPrimaryAppChain(chainId)) return true;
  if (!switchChainAsync) return false;
  return await switchOrAddPrimaryChain(switchChainAsync);
}


