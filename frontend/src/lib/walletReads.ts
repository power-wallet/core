'use client';

import { useReadContract } from 'wagmi';
import { powerWalletAbi, simpleDcaAbi } from './abi';

export function useWalletReads(walletAddress: `0x${string}` | null) {
  const enabled = Boolean(walletAddress);

  const { data: assets } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getRiskAssets',
    query: { enabled, refetchInterval: 60000 },
  });
  const { data: isClosed } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'isClosed',
    query: { enabled },
  });
  const { data: balances, refetch: refetchBalances } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getBalances',
    query: { enabled, refetchInterval: 60000 },
  });
  const { data: valueUsd, refetch: refetchValueUsd } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getPortfolioValueUSD',
    query: { enabled, refetchInterval: 60000 },
  });
  const { data: strategyAddr } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'strategy',
    query: { enabled },
  });
  const { data: createdAtTs } = useReadContract({
    address: walletAddress || undefined,
    abi: [ { type: 'function', name: 'createdAt', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint64' } ] } ] as const,
    functionName: 'createdAt',
    query: { enabled },
  });
  const { data: automationPaused } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'automationPaused',
    query: { enabled },
  });
  const { data: slippage, refetch: refetchSlippage } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'slippageBps',
    query: { enabled, refetchInterval: 60000 },
  });
  const { data: stableTokenAddr } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'stableAsset',
    query: { enabled, refetchInterval: 60000 },
  });

  const { data: depositsData, refetch: refetchDeposits } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getDeposits',
    query: { enabled, refetchInterval: 60000 },
  });
  const { data: withdrawalsData, refetch: refetchWithdrawals } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getWithdrawals',
    query: { enabled, refetchInterval: 60000 },
  });
  const { data: swapsData, refetch: refetchSwaps } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getSwaps',
    query: { enabled, refetchInterval: 60000 },
  });

  return {
    assets,
    isClosed,
    balances,
    refetchBalances,
    valueUsd,
    refetchValueUsd,
    strategyAddr,
    createdAtTs,
    automationPaused,
    slippage,
    refetchSlippage,
    stableTokenAddr,
    depositsData,
    refetchDeposits,
    withdrawalsData,
    refetchWithdrawals,
    swapsData,
    refetchSwaps,
  } as const;
}

export function useStrategyReads(strategyAddr?: `0x${string}` | null) {
  const enabled = Boolean(strategyAddr);
  const { data: dcaAmount } = useReadContract({
    address: strategyAddr || undefined,
    abi: simpleDcaAbi as any,
    functionName: 'dcaAmountStable',
    query: { enabled },
  });
  // PowerBtcDcaV1 uses baseDcaStable instead of dcaAmountStable
  const { data: baseDcaAmount } = useReadContract({
    address: strategyAddr || undefined,
    abi: [ { type: 'function', name: 'baseDcaStable', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] } ] as const,
    functionName: 'baseDcaStable',
    query: { enabled },
  });
  const { data: freq } = useReadContract({
    address: strategyAddr || undefined,
    abi: simpleDcaAbi as any,
    functionName: 'frequency',
    query: { enabled },
  });
  const { data: desc } = useReadContract({
    address: strategyAddr || undefined,
    abi: simpleDcaAbi as any,
    functionName: 'description',
    query: { enabled },
  });
  const { data: strategyName } = useReadContract({
    address: strategyAddr || undefined,
    abi: [ { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'string' } ] } ] as const,
    functionName: 'name',
    query: { enabled },
  });
  const { data: strategyIdStr } = useReadContract({
    address: strategyAddr || undefined,
    abi: [ { type: 'function', name: 'id', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'string' } ] } ] as const,
    functionName: 'id',
    query: { enabled },
  });

  return { dcaAmount, baseDcaAmount, freq, desc, strategyName, strategyIdStr } as const;
}


