'use client';

import React, { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert, CircularProgress, useMediaQuery, useTheme, FormControl, InputLabel, Select, MenuItem, IconButton, Table, TableHead, TableRow, TableCell, TableBody, Divider, TableContainer, Tooltip } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import SettingsIcon from '@mui/icons-material/Settings';
import ConfigSimpleDcaV1 from './strategies/ConfigSimpleDcaV1';
import ConfigSmartBtcDcaV1 from './strategies/ConfigSmartBtcDcaV1';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import WalletHistoryChart from './charts/WalletHistoryChart';
import { buildWalletHistorySeries } from '@/lib/walletHistory';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import appConfig from '@/config/appConfig.json';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import { getChainKey } from '@/config/networks';
import { ensureOnPrimaryChain, getFriendlyChainName } from '@/lib/web3';
import { createPublicClient, http, parseUnits } from 'viem';
import { getViemChain } from '@/config/networks';
import { findUpkeepIdForTarget } from '@/lib/chainlink/automation';

const powerWalletAbi = [
  { type: 'function', name: 'getBalances', stateMutability: 'view', inputs: [], outputs: [
    { name: 'stableBal', type: 'uint256' },
    { name: 'riskBals', type: 'uint256[]' },
  ] },
  { type: 'function', name: 'getRiskAssets', stateMutability: 'view', inputs: [], outputs: [ { name: 'assets', type: 'address[]' } ] },
  { type: 'function', name: 'getPortfolioValueUSD', stateMutability: 'view', inputs: [], outputs: [ { name: 'usd6', type: 'uint256' } ] },
  { type: 'function', name: 'strategy', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'address' } ] },
  { type: 'function', name: 'stableAsset', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'address' } ] },
  { type: 'function', name: 'isClosed', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'bool' } ] },
  { type: 'function', name: 'automationPaused', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'bool' } ] },
  { type: 'function', name: 'pauseAutomation', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'unpauseAutomation', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'slippageBps', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'setSlippageBps', stateMutability: 'nonpayable', inputs: [ { name: 'newSlippageBps', type: 'uint16' } ], outputs: [] },
  { type: 'function', name: 'closeWallet', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'withdrawAsset', stateMutability: 'nonpayable', inputs: [ { name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'getDeposits', stateMutability: 'view', inputs: [], outputs: [ { type: 'tuple[]', components: [ { name: 'timestamp', type: 'uint256' }, { name: 'user', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'balanceAfter', type: 'uint256' } ] } ] },
  { type: 'function', name: 'getWithdrawals', stateMutability: 'view', inputs: [], outputs: [ { type: 'tuple[]', components: [ { name: 'timestamp', type: 'uint256' }, { name: 'user', type: 'address' }, { name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'balanceAfter', type: 'uint256' } ] } ] },
  { type: 'function', name: 'getSwaps', stateMutability: 'view', inputs: [], outputs: [ { type: 'tuple[]', components: [ { name: 'timestamp', type: 'uint256' }, { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOut', type: 'uint256' }, { name: 'balanceInAfter', type: 'uint256' }, { name: 'balanceOutAfter', type: 'uint256' } ] } ] },
] as const;

const simpleDcaAbi = [
  { type: 'function', name: 'description', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'string' } ] },
  { type: 'function', name: 'frequency', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'dcaAmountStable', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
] as const;

function formatUsd6(v?: bigint) {
  if (!v) return '$0.00';
  const num = Number(v) / 1_000_000;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WalletDetails() {
  const sp = useSearchParams();
  const walletAddress = sp.get('address') as `0x${string}` | null;
  const chainId = useChainId();
  const { address: connected } = useAccount();
  const chainKey = getChainKey(chainId);
  const explorerBase = (appConfig as any)[chainKey]?.explorer || '';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const shortAddress = React.useMemo(() => {
    if (!walletAddress || walletAddress.length < 10) return walletAddress || '';
    return `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const { data: assets } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getRiskAssets',
    query: { enabled: Boolean(walletAddress) },
  });
  const { data: isClosed } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'isClosed',
    query: { enabled: Boolean(walletAddress) },
  });
  const { data: balances } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getBalances',
    query: { enabled: Boolean(walletAddress) },
  });
  const { data: valueUsd } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getPortfolioValueUSD',
    query: { enabled: Boolean(walletAddress) },
  });
  const { data: strategyAddr } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'strategy',
    query: { enabled: Boolean(walletAddress) },
  });
  const { data: automationPaused } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'automationPaused',
    query: { enabled: Boolean(walletAddress) },
  });
  const { data: slippage, refetch: refetchSlippage } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'slippageBps',
    query: { enabled: Boolean(walletAddress) },
  });
  const { data: stableTokenAddr } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'stableAsset',
    query: { enabled: Boolean(walletAddress) },
  });

  const { data: dcaAmount } = useReadContract({
    address: strategyAddr as `0x${string}` | undefined,
    abi: simpleDcaAbi as any,
    functionName: 'dcaAmountStable',
    query: { enabled: Boolean(strategyAddr) },
  });
  const { data: freq } = useReadContract({
    address: strategyAddr as `0x${string}` | undefined,
    abi: simpleDcaAbi as any,
    functionName: 'frequency',
    query: { enabled: Boolean(strategyAddr) },
  });
  const { data: desc } = useReadContract({
    address: strategyAddr as `0x${string}` | undefined,
    abi: simpleDcaAbi as any,
    functionName: 'description',
    query: { enabled: Boolean(strategyAddr) },
  });
  const { data: strategyName } = useReadContract({
    address: strategyAddr as `0x${string}` | undefined,
    abi: [ { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'string' } ] } ] as const,
    functionName: 'name',
    query: { enabled: Boolean(strategyAddr) },
  });

  // Transactions
  const { data: depositsData } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getDeposits',
    query: { enabled: Boolean(walletAddress) },
  });
  const { data: withdrawalsData } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getWithdrawals',
    query: { enabled: Boolean(walletAddress) },
  });
  const { data: swapsData } = useReadContract({
    address: walletAddress || undefined,
    abi: powerWalletAbi as any,
    functionName: 'getSwaps',
    query: { enabled: Boolean(walletAddress) },
  });

  const riskAssets = React.useMemo(() => (assets as string[] | undefined) || [], [assets]);
  const stableBal = (balances as any)?.[0] as bigint | undefined;
  const riskBals = ((balances as any)?.[1] as bigint[] | undefined) || [];
  const sb = (stableBal !== undefined ? stableBal : BigInt(0));
  const anyRisk = riskBals.some((b) => (b !== undefined ? b : BigInt(0)) > BigInt(0));
  const hasAnyFunds = sb > BigInt(0) || anyRisk;

  const chainAssets = (appConfig as any)[chainKey]?.assets as Record<string, { address: string; symbol: string; decimals: number; feed: `0x${string}` }>;
  const addressToMeta = React.useCallback((addr: string | undefined) => {
    if (!addr) return undefined;
    const lower = addr.toLowerCase();
    const entries = Object.values(chainAssets);
    return entries.find(a => a.address.toLowerCase() === lower);
  }, [chainAssets]);

  const formatTokenAmount = (amount?: bigint, decimals?: number) => {
    if (amount === undefined || decimals === undefined) return '0';
    const s = amount.toString();
    if (decimals === 0) return s;
    if (s.length > decimals) {
      const whole = s.slice(0, s.length - decimals);
      const frac = s.slice(s.length - decimals).replace(/0+$/, '');
      return frac ? `${whole}.${frac}` : whole;
    } else {
      const zeros = '0'.repeat(decimals - s.length);
      const frac = `${zeros}${s}`;
      return `0.${frac}`;
    }
  };

  const formatAllowance = (amount?: bigint) => {
    if (amount === undefined) return '0';
    if (amount === BigInt(0)) return '0';
    return formatTokenAmount(amount, 6);
  };

  const formatDate = (ts?: bigint | number) => {
    if (ts === undefined) return '';
    const n = typeof ts === 'number' ? ts : Number(ts);
    return new Date(n * 1000).toLocaleString();
  };
  const formatDateOnly = (ts?: bigint | number) => {
    if (ts === undefined) return '';
    const n = typeof ts === 'number' ? ts : Number(ts);
    return new Date(n * 1000).toLocaleDateString();
  };
  const formatDateTime = (ts?: bigint | number) => {
    if (ts === undefined) return '';
    const n = typeof ts === 'number' ? ts : Number(ts);
    return new Date(n * 1000).toLocaleString();
  };

  // Also read user USDC balance via wagmi to avoid any race in the effect
  const { data: userUsdcBalance } = useReadContract({
    address: (stableTokenAddr as `0x${string}`) || undefined,
    abi: [
      { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [ { name: 'account', type: 'address' } ], outputs: [ { name: '', type: 'uint256' } ] },
    ] as const,
    functionName: 'balanceOf',
    args: connected ? [connected as `0x${string}`] : undefined,
    query: { enabled: Boolean(stableTokenAddr && connected) },
  });

  const client = useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http() }), [chainId]);

  const aggregatorAbi = useMemo(() => ([
    { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
    { type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [], outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ] },
  ] as const), []);

  const [prices, setPrices] = React.useState<Record<string, { price: number; decimals: number }>>({});
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: 'info' | 'success' | 'error' }>({ open: false, message: '', severity: 'info' });

  const [depositOpen, setDepositOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [depositAmount, setDepositAmount] = React.useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = React.useState<string>('');
  const [withdrawAssetAddr, setWithdrawAssetAddr] = React.useState<`0x${string}` | ''>('');
  const [isDepositing, setIsDepositing] = React.useState(false);
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);
  const [allowance, setAllowance] = React.useState<bigint | undefined>(undefined);
  const [userStableBalance, setUserStableBalance] = React.useState<bigint | undefined>(undefined);
  const [upkeepId, setUpkeepId] = React.useState<bigint | null | undefined>(undefined);
  const [upkeepError, setUpkeepError] = React.useState(false);
  const [upkeepRefresh, setUpkeepRefresh] = React.useState(0);
  const [slippageOpen, setSlippageOpen] = React.useState(false);
  const [slippageInput, setSlippageInput] = React.useState<string>('');
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [strategyConfigOpen, setStrategyConfigOpen] = React.useState(false);

  // createdAt for history chart
  const { data: createdAtTs } = useReadContract({
    address: walletAddress || undefined,
    abi: [ { type: 'function', name: 'createdAt', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint64' } ] } ] as const,
    functionName: 'createdAt',
    query: { enabled: Boolean(walletAddress) },
  });

  // Build wallet value time series for chart
  const [walletSeries, setWalletSeries] = React.useState<any[] | null>(null);
  const [historyLoading, setHistoryLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      if (!walletAddress || !createdAtTs) return;
      try {
        setHistoryLoading(true);
        const stableMeta = addressToMeta(stableTokenAddr as string | undefined);
        if (!stableMeta) { setWalletSeries([]); setHistoryLoading(false); return; }
        const riskMetas = riskAssets.map((a) => addressToMeta(a)).filter(Boolean) as { address: string; symbol: string; decimals: number; feed: `0x${string}` }[];
        const deposits = (depositsData as any[] | undefined)?.map((d) => ({ timestamp: d.timestamp as bigint, user: d.user as `0x${string}`, amount: d.amount as bigint, balanceAfter: d.balanceAfter as bigint })) || [];
        const withdrawals = (withdrawalsData as any[] | undefined)?.map((w) => ({ timestamp: w.timestamp as bigint, user: w.user as `0x${string}`, asset: w.asset as `0x${string}`, amount: w.amount as bigint, balanceAfter: w.balanceAfter as bigint })) || [];
        const swaps = (swapsData as any[] | undefined)?.map((s) => ({ timestamp: s.timestamp as bigint, tokenIn: s.tokenIn as `0x${string}`, tokenOut: s.tokenOut as `0x${string}`, amountIn: s.amountIn as bigint, amountOut: s.amountOut as bigint, balanceInAfter: s.balanceInAfter as bigint, balanceOutAfter: s.balanceOutAfter as bigint })) || [];
        const series = await buildWalletHistorySeries({
          createdAt: createdAtTs as bigint,
          stable: { address: (stableTokenAddr as `0x${string}`)!, symbol: stableMeta.symbol, decimals: stableMeta.decimals },
          risks: riskMetas.map(r => ({ address: r.address as `0x${string}`, symbol: r.symbol, decimals: r.decimals })),
          deposits,
          withdrawals,
          swaps,
        });
        setWalletSeries(series);
      } catch (e) {
        setWalletSeries([]);
      } finally {
        setHistoryLoading(false);
      }
    })();
  }, [walletAddress, createdAtTs, depositsData, withdrawalsData, swapsData, stableTokenAddr, riskAssets, addressToMeta]);

  React.useEffect(() => {
    if (txHash) {
      setToast({ open: true, message: 'Transaction submitted. Waiting for confirmation…', severity: 'info' });
    }
  }, [txHash]);

  React.useEffect(() => {
    if (isConfirmed && txHash) {
      setToast({ open: true, message: `Transaction confirmed: ${txHash}`, severity: 'success' });
    }
  }, [isConfirmed, txHash]);

  React.useEffect(() => {
    const metas = [addressToMeta(chainAssets.cbBTC.address), addressToMeta(chainAssets.WETH.address), addressToMeta(chainAssets.USDC.address)].filter(Boolean) as { address: string; symbol: string; decimals: number; feed: `0x${string}` }[];
    (async () => {
      const next: Record<string, { price: number; decimals: number }> = {};
      for (const m of metas) {
        try {
          const [dec, round] = await Promise.all([
            client.readContract({ address: m.feed, abi: aggregatorAbi as any, functionName: 'decimals', args: [] }) as Promise<number>,
            client.readContract({ address: m.feed, abi: aggregatorAbi as any, functionName: 'latestRoundData', args: [] }) as Promise<any>,
          ]);
          const p = Number(round[1]);
          next[m.symbol] = { price: p, decimals: dec };
        } catch (e) {}
      }
      setPrices(next);
    })();
  }, [client, addressToMeta, aggregatorAbi, chainAssets.cbBTC.address, chainAssets.WETH.address, chainAssets.USDC.address]);

  React.useEffect(() => {
    (async () => {
      if (!depositOpen || !stableTokenAddr || !walletAddress || !connected) return;
      try {
        const erc20ReadAbi = [
          { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [ { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' } ], outputs: [ { name: '', type: 'uint256' } ] },
        ] as const;
        const a = await client.readContract({ address: stableTokenAddr as `0x${string}`, abi: erc20ReadAbi as any, functionName: 'allowance', args: [connected as `0x${string}`, walletAddress] }) as bigint;
        setAllowance(a);
      } catch (e) {
        setAllowance(undefined);
      }
    })();
  }, [depositOpen, stableTokenAddr, walletAddress, connected, client]);

  // Show chart only if there is at least one transaction
  const hasAnyTransactions = React.useMemo(() => {
    const d = Array.isArray(depositsData) ? depositsData : [];
    const w = Array.isArray(withdrawalsData) ? withdrawalsData : [];
    const s = Array.isArray(swapsData) ? swapsData : [];
    return d.length > 0 || w.length > 0 || s.length > 0;
  }, [depositsData, withdrawalsData, swapsData]);

  // Initialize selected withdraw asset when modal opens
  React.useEffect(() => {
    if (!withdrawOpen) return;
    const preferred = (stableTokenAddr as `0x${string}` | undefined) || (riskAssets[0] as `0x${string}` | undefined) || '' as any;
    setWithdrawAssetAddr(preferred || '');
  }, [withdrawOpen, stableTokenAddr, riskAssets]);

  // Temporary feature flag: disable Chainlink Automation detection
  const ENABLE_UPKEEP_DETECTION = false;

  // Discover Chainlink Automation Upkeep ID on Base Sepolia only (robust with retries and timeout)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ENABLE_UPKEEP_DETECTION) {
        if (!cancelled) { setUpkeepError(false); setUpkeepId(null); }
        return;
      }
      setUpkeepError(false);
      if (!walletAddress) { if (!cancelled) setUpkeepId(undefined); return; }
      if (chainId !== 84532) { if (!cancelled) setUpkeepId(null); return; }
      const rpcFallbacks = [
        // 'https://base-sepolia.g.alchemy.com/v2/demo',
        'https://sepolia.base.org',
        // 'https://base-sepolia.blockpi.network/v1/rpc/public',
      ];
      const MAX_ATTEMPTS = 10;
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt++) {
        try {
          const p = findUpkeepIdForTarget(walletAddress as `0x${string}`, { chainId, pageSize: 1000, rpcUrls: rpcFallbacks, errorLimit: 10, lastBlocks: 1_000_000, maxActiveScan: 1000 });
          const res = await Promise.race<bigint | null>([
            p,
            new Promise<bigint | null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ]);
          if (cancelled) return;
          setUpkeepId(res);
          return;
        } catch {
          // continue
        }
      }
      if (!cancelled) { setUpkeepError(true); setUpkeepId(null); }
    })();
    return () => { cancelled = true; };
  }, [walletAddress, chainId, upkeepRefresh, ENABLE_UPKEEP_DETECTION]);

  if (!walletAddress) return null;

  // If wallet is closed, show only the banner and breadcrumb
  if (isClosed === true) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>My Wallet</Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 3 }}>
          <a
            href="/portfolio"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            Portfolio
          </a>
          {` / `}
          <span>{shortAddress}</span>
          <a
            href={`${explorerBase}/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', marginLeft: 6, display: 'inline-flex', alignItems: 'center' }}
            aria-label="Open on block explorer"
          >
            <LaunchIcon sx={{ fontSize: 14 }} />
          </a>
        </Typography>
        <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'warning.main', bgcolor: 'rgba(245, 158, 11, 0.08)', borderRadius: 1 }}>
          <Typography variant="subtitle1" sx={{ color: 'warning.main', fontWeight: 'bold' }}>This wallet has been closed</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>You can no longer deposit or trade with this wallet.</Typography>
          <Box sx={{ mt: 1 }}>
            <Button variant="outlined" size="small" href="/portfolio">Back to Portfolio</Button>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>My Wallet</Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 3 }}>
        <a
          href="/portfolio"
          style={{ color: 'inherit', textDecoration: 'underline' }}
        >
          Portfolio
        </a>
        {` / `}
        <span>{shortAddress}</span>
        <a
          href={`${explorerBase}/address/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit', marginLeft: 6, display: 'inline-flex', alignItems: 'center' }}
          aria-label="Open on block explorer"
        >
          <LaunchIcon sx={{ fontSize: 14 }} />
        </a>
      </Typography>

      {hasAnyTransactions && walletSeries && walletSeries.length ? (
        <Box sx={{ mb: 3 }}>
          <WalletHistoryChart data={walletSeries as any} />
        </Box>
      ) : null}

      {isClosed ? (
        <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'warning.main', bgcolor: 'rgba(245, 158, 11, 0.08)', borderRadius: 1 }}>
          <Typography variant="subtitle1" sx={{ color: 'warning.main', fontWeight: 'bold' }}>This wallet has been closed</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>You can no longer deposit or trade with this wallet.</Typography>
          <Box sx={{ mt: 1 }}>
            <Button variant="outlined" size="small" href="/portfolio">Back to Portfolio</Button>
          </Box>
        </Box>
      ) : null}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">My Assets</Typography>
              {isMobile ? (
                <Stack spacing={0.75} sx={{ mt: 1, minWidth: 0 }}>
                  {(['cbBTC', 'USDC', 'WETH'] as const).map((sym) => {
                    const m = (chainAssets as any)[sym] as { address: string; symbol: string; decimals: number; feed?: `0x${string}` } | undefined;
                    if (!m) return null;
                    let amt: bigint | undefined = sym === 'USDC'
                      ? stableBal
                      : (() => {
                          const idx = riskAssets.findIndex(x => x.toLowerCase() === m.address.toLowerCase());
                          return idx === -1 ? undefined : riskBals[idx];
                        })();
                    if (amt === undefined) return null;
                    const p = prices[m.symbol];
                    const usd = p ? (Number(amt) * p.price) / 10 ** (m.decimals + p.decimals) : undefined;
                    return (
                      <Box key={sym} sx={{ display: 'flex', flexDirection: 'column', gap: 0.15, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                          {formatTokenAmount(amt, m.decimals)} {m.symbol}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                          {usd !== undefined ? `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </Typography>
                      </Box>
                    );
                  })}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Total Value</Typography>
                    <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
                      {formatUsd6(valueUsd as bigint)}
                    </Typography>
                  </Box>
                  </Stack>
              ) : (
                <Grid container spacing={0.5} sx={{ mt: 1, pr: 0.5 }} textAlign={'center'}>
                {(['cbBTC', 'WETH', 'USDC'] as const).map((sym) => {
                  const m = (chainAssets as any)[sym] as { address: string; symbol: string; decimals: number; feed?: `0x${string}` } | undefined;
                  if (!m) return null;
                  let amt: bigint | undefined = sym === 'USDC'
                    ? stableBal
                    : (() => {
                        const idx = riskAssets.findIndex(x => x.toLowerCase() === m.address.toLowerCase());
                        return idx === -1 ? undefined : riskBals[idx];
                      })();
                  if (amt === undefined) return null;
                  const p = prices[m.symbol];
                  const usd = p ? (Number(amt) * p.price) / 10 ** (m.decimals + p.decimals) : undefined;
                  return (
                    <Grid key={sym} item xs={12} sm={6} md={4}>
                      <Stack>
                          <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '1.1rem', pr: 0.1}}>
                          {formatTokenAmount(amt, m.decimals)} {m.symbol}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1rem' }}>
                          {usd !== undefined ? `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </Typography>
                      </Stack>
                    </Grid>
                  );
                })}
                  <Grid item xs={12} sm={6} md={4}>
                    <Stack>
                      <Typography variant="caption">Total Value</Typography>
                      <Typography variant="h5">{formatUsd6(valueUsd as bigint)}</Typography>
                    </Stack>
                  </Grid>
              </Grid>
              )}

              
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button variant="outlined" size="small" onClick={() => setDepositOpen(true)}>Deposit</Button>
                <Button variant="outlined" size="small" onClick={() => setWithdrawOpen(true)}>Withdraw</Button>
              </Stack>
              {chainKey === 'base-sepolia' && (userUsdcBalance !== undefined) && ((userUsdcBalance as bigint) === BigInt(0)) ? (
                <Alert severity="info" sx={{ mt: 3 }}>
                  You can claim testnet USDC from the{' '}
                  <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Circle Faucet</a>.
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>Strategy</Typography>
                <IconButton size="small" aria-label="Configure strategy" onClick={() => setStrategyConfigOpen(true)}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {strategyName ? `${String(strategyName)} - ${String(desc || '')}` : String(desc || '')}
            </Typography>
              {strategyAddr ? (
                <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
                  <span>{`${String(strategyAddr).slice(0, 6)}…${String(strategyAddr).slice(-4)}`}</span>
                  <a
                    href={`${explorerBase}/address/${strategyAddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', marginLeft: 6, display: 'inline-flex', alignItems: 'center' }}
                    aria-label="Open strategy on block explorer"
                  >
                    <LaunchIcon sx={{ fontSize: 14 }} />
                  </a>
                </Typography>
              ) : null}
              <Stack direction="row" spacing={3} sx={{ mt: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption">DCA Amount</Typography>
                  <Typography variant="body1">
                    {(() => {
                      const nm = String(strategyName || '').trim();
                      if (nm === 'Smart BTC DCA (Power Law)') return 'Dynamic USDC %';
                      return formatUsd6(dcaAmount as bigint);
                    })()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption">Frequency</Typography>
                  <Typography variant="body1">{freq ? `${Number(freq) / 86400} d` : '-'}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Wallet Config + Automate Your Wallet side by side on desktop */}
      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" fontWeight="bold">Wallet Config</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Automation</Typography>
                  <Typography variant="body2">{automationPaused ? 'Paused' : 'Active'}</Typography>
                </Box>
                  <Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={async () => {
                      const ok = await ensureOnPrimaryChain(chainId as number, (args: any) => (window as any));
                      // ensureOnPrimaryChain here does not switch; we rely on global guard and Portfolio actions. Skip switching in nested actions.
                      if (!walletAddress) return;
                      try {
                        let maxFeePerGas: bigint | undefined;
                        let maxPriorityFeePerGas: bigint | undefined;
                        try {
                          const fees = await client.estimateFeesPerGas();
                          maxFeePerGas = fees.maxFeePerGas;
                          maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? parseUnits('1', 9);
                        } catch {}
                        const fn = automationPaused ? 'unpauseAutomation' : 'pauseAutomation';
                        const hash = await writeContractAsync({
                          address: walletAddress,
                          abi: powerWalletAbi as any,
                          functionName: fn as any,
                          args: [],
                          ...(maxFeePerGas ? { maxFeePerGas } : {}),
                          ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
                        });
                        setTxHash(hash as `0x${string}`);
                      } catch (e: any) {
                        setToast({ open: true, message: e?.shortMessage || e?.message || 'Transaction failed', severity: 'error' });
                      }
                    }}
                  >
                    {automationPaused ? 'Activate Automation' : 'Pause Automation'}
                  </Button>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Slippage</Typography>
                  <Typography variant="body2">{slippage ? `${Number(slippage)} bps (${(Number(slippage)/100).toFixed(2)}%)` : '-'}</Typography>
                </Box>
                <Box>
                  <Button size="small" variant="outlined" onClick={() => {
                    setSlippageInput(slippage ? String(Number(slippage)) : '');
                    setSlippageOpen(true);
                  }}>Update Slippage</Button>
                  </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="subtitle1" fontWeight="bold">Automate Your Wallet</Typography>
        {upkeepId === undefined && !upkeepError ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Checking Chainlink Automation status…
          </Typography>
        ) : upkeepId ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              Upkeep registered for this wallet: ID {upkeepId.toString()}.
            </Typography>
            <Button
              variant="outlined"
              href={`https://automation.chain.link/base-sepolia/upkeeps/${upkeepId.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Upkeep
            </Button>
          </>
        ) : upkeepError ? (
          <>
            <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
              Unable to reach Chainlink Automation right now. Please try again later or open Automation.
            </Alert>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                href="https://automation.chain.link/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Automation
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => setUpkeepRefresh((x) => x + 1)}
              >
                Retry
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                  To automate the execution of your wallet strategy, register an Upkeep for the address of this wallet with Chainlink Automation.
            </Typography>
            <Button
              variant="outlined"
                    size="small"
              href="https://automation.chain.link/base-sepolia"
              target="_blank"
              rel="noopener noreferrer"
                    sx={{ alignSelf: 'flex-start' }}
            >
              Open Chainlink Automation
            </Button>
          </>
        )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Deposit Modal */}
      <Dialog open={depositOpen} onClose={() => setDepositOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Deposit USDC</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Amount (USDC)"
            type="number"
            fullWidth
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            inputProps={{ min: 0, step: '0.01' }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Your balance: {formatTokenAmount((userUsdcBalance as bigint) ?? userStableBalance, 6)} USDC
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Allowance: {formatAllowance(allowance)} USDC
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!stableTokenAddr || !walletAddress) return;
              const amount = Math.max(0, Number(depositAmount || '0'));
              if (amount <= 0) return;
              const amt = BigInt(Math.round(amount * 1_000_000));
              setIsDepositing(true);
              try {
                let maxFeePerGas: bigint | undefined;
                let maxPriorityFeePerGas: bigint | undefined;
                try {
                  const fees = await client.estimateFeesPerGas();
                  maxFeePerGas = fees.maxFeePerGas;
                  maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? parseUnits('1', 9);
                } catch {}
                const erc20ReadAbi = [
                  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [ { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' } ], outputs: [ { name: '', type: 'uint256' } ] },
                  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [ { name: 'account', type: 'address' } ], outputs: [ { name: '', type: 'uint256' } ] },
                ] as const;
                const [allowance, balance] = await Promise.all([
                  client.readContract({ address: stableTokenAddr as `0x${string}`, abi: erc20ReadAbi as any, functionName: 'allowance', args: [connected as `0x${string}`, walletAddress] }) as Promise<bigint>,
                  client.readContract({ address: stableTokenAddr as `0x${string}`, abi: erc20ReadAbi as any, functionName: 'balanceOf', args: [connected as `0x${string}`] }) as Promise<bigint>,
                ]);
                if (balance < amt) {
                  setToast({ open: true, message: 'Insufficient USDC balance', severity: 'error' });
                  return;
                }
                if (allowance < amt) {
                  const erc20WriteAbi = [
                    { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [ { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' } ], outputs: [ { name: '', type: 'bool' } ] },
                  ] as const;
                  const approveHash = await writeContractAsync({
                    address: stableTokenAddr as `0x${string}`,
                    abi: erc20WriteAbi as any,
                    functionName: 'approve',
                    args: [walletAddress, amt],
                    ...(maxFeePerGas ? { maxFeePerGas } : {}),
                    ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
                  });
                  setTxHash(approveHash as `0x${string}`);
                  await client.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
                }
                const depositHash = await writeContractAsync({
                  address: walletAddress,
                  abi: powerWalletAbi as any,
                  functionName: 'deposit',
                  args: [amt],
                  ...(maxFeePerGas ? { maxFeePerGas } : {}),
                  ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
                });
                setTxHash(depositHash as `0x${string}`);
                setDepositOpen(false);
                setDepositAmount('');
              } catch (e: any) {
                const msg = e?.shortMessage || e?.message || 'Deposit failed';
                setToast({ open: true, message: msg, severity: 'error' });
              } finally {
                setIsDepositing(false);
              }
            }}
            disabled={isDepositing}
          >
            {isDepositing ? (<><CircularProgress size={16} sx={{ mr: 1 }} /> Depositing…</>) : 'Deposit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Slippage Modal */}
      <Dialog open={slippageOpen} onClose={() => setSlippageOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Update Slippage</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={`Slippage (bps) — ${(Number(slippage ?? 0)/100).toFixed(2)}%`}
            type="number"
            fullWidth
            value={slippageInput}
            onChange={(e) => setSlippageInput(e.target.value)}
            inputProps={{ min: 0, max: 4999, step: 1, placeholder: String(Number(slippage ?? 0)) }}
            helperText="Max 5000 bps (50%)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSlippageOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!walletAddress) return;
              const val = Math.max(0, Math.floor(Number(slippageInput || '0')));
              if (Number.isNaN(val) || val >= 5000) {
                setToast({ open: true, message: 'Enter a value below 5000', severity: 'error' });
                return;
              }
              try {
                let maxFeePerGas: bigint | undefined;
                let maxPriorityFeePerGas: bigint | undefined;
                try {
                  const fees = await client.estimateFeesPerGas();
                  maxFeePerGas = fees.maxFeePerGas;
                  maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? parseUnits('1', 9);
                } catch {}
                const hash = await writeContractAsync({
                  address: walletAddress,
                  abi: powerWalletAbi as any,
                  functionName: 'setSlippageBps',
                  args: [val],
                  ...(maxFeePerGas ? { maxFeePerGas } : {}),
                  ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
                });
                setTxHash(hash as `0x${string}`);
                await client.waitForTransactionReceipt({ hash: hash as `0x${string}` });
                await refetchSlippage();
                setSlippageOpen(false);
              } catch (e: any) {
                setToast({ open: true, message: e?.shortMessage || e?.message || 'Update failed', severity: 'error' });
              }
            }}
          >
            Update Slippage
          </Button>
        </DialogActions>
      </Dialog>

      {/* Withdraw Modal (supports stable and risk assets) */}
      <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Withdraw Asset</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="withdraw-asset-label">Asset</InputLabel>
            <Select
              labelId="withdraw-asset-label"
              label="Asset"
              value={withdrawAssetAddr || ''}
              onChange={(e) => setWithdrawAssetAddr(e.target.value as `0x${string}`)}
            >
              {stableTokenAddr ? (
                <MenuItem value={stableTokenAddr as `0x${string}`}>USDC</MenuItem>
              ) : null}
              {riskAssets.map((ra) => {
                const key = String(ra);
                const m = addressToMeta(key);
                const sym = m?.symbol || `${key.slice(0, 6)}…${key.slice(-4)}`;
                return <MenuItem key={key} value={key as `0x${string}`}>{sym}</MenuItem>;
              })}
            </Select>
          </FormControl>
          <TextField
            autoFocus
            margin="dense"
            label={(() => {
              const m = addressToMeta(withdrawAssetAddr);
              return `Amount (${m?.symbol || 'token'})`;
            })()}
            type="number"
            fullWidth
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            inputProps={{ min: 0, step: '0.000001' }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {(() => {
              const addr = withdrawAssetAddr?.toLowerCase();
              const isStable = addr && stableTokenAddr && addr === String(stableTokenAddr).toLowerCase();
              let bal: bigint | undefined = undefined;
              if (isStable) {
                bal = stableBal;
              } else if (addr) {
                const idx = riskAssets.findIndex(x => x.toLowerCase() === addr);
                bal = idx === -1 ? undefined : riskBals[idx];
              }
              const dec = addressToMeta(withdrawAssetAddr || '')?.decimals;
              const sym = addressToMeta(withdrawAssetAddr || '')?.symbol || 'token';
              return bal !== undefined && dec !== undefined ? `Available: ${formatTokenAmount(bal, dec)} ${sym}` : '';
            })()}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!walletAddress || !withdrawAssetAddr) return;
              const amount = Math.max(0, Number(withdrawAmount || '0'));
              if (amount <= 0) return;
              const meta = addressToMeta(withdrawAssetAddr);
              const decimals = meta?.decimals ?? 6;
              const scale = Math.pow(10, Math.min(decimals, 18));
              const amt = BigInt(Math.round(amount * scale));
              setIsWithdrawing(true);
              try {
                let maxFeePerGas: bigint | undefined;
                let maxPriorityFeePerGas: bigint | undefined;
                try {
                  const fees = await client.estimateFeesPerGas();
                  maxFeePerGas = fees.maxFeePerGas;
                  maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? parseUnits('1', 9);
                } catch {}
                const hash = await writeContractAsync({
                  address: walletAddress,
                  abi: powerWalletAbi as any,
                  functionName: 'withdrawAsset',
                  args: [withdrawAssetAddr, amt],
                  ...(maxFeePerGas ? { maxFeePerGas } : {}),
                  ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
                });
                setTxHash(hash as `0x${string}`);
                setWithdrawOpen(false);
                setWithdrawAmount('');
              } catch (e) {
                setToast({ open: true, message: 'Withdraw failed', severity: 'error' });
              } finally {
                setIsWithdrawing(false);
              }
            }}
            disabled={isWithdrawing}
          >
            {isWithdrawing ? (<><CircularProgress size={16} sx={{ mr: 1 }} /> Withdrawing…</>) : 'Withdraw'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Strategy Config Modal */}
      <Dialog open={strategyConfigOpen} onClose={() => setStrategyConfigOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Configure Strategy</DialogTitle>
        <DialogContent>
          {(() => {
            // Determine strategy id by matching description from appConfig
            const strategies = (appConfig as any)[chainKey]?.strategies || {};
            const descStr = String(desc || '').trim();
            let matchedId: string | null = null;
            let stableKey: string | null = null;
            for (const [id, st] of Object.entries<any>(strategies)) {
              if (String(st.description).trim() === descStr) {
                matchedId = id;
                stableKey = st.stable;
                break;
              }
            }
            if (matchedId === 'simple-btc-dca-v1') {
              const stableMeta = stableKey ? (appConfig as any)[chainKey].assets[Object.keys((appConfig as any)[chainKey].assets).find(k => k.toLowerCase() === String(stableKey).toLowerCase()) as string] : null;
              const stableSymbol = stableMeta?.symbol || 'USDC';
              const stableDecimals = stableMeta?.decimals ?? 6;
              return (
                <ConfigSimpleDcaV1
                  strategyAddr={String(strategyAddr) as `0x${string}`}
                  chainId={chainId}
                  stableSymbol={stableSymbol}
                  stableDecimals={stableDecimals}
                  initialAmountStable={dcaAmount as bigint}
                  initialFrequency={freq as bigint}
                />
              );
            }
            if (matchedId === 'btc-dca-power-law-v1') {
              return (
                <ConfigSmartBtcDcaV1
                  strategyAddr={String(strategyAddr) as `0x${string}`}
                  chainId={chainId}
                />
              );
            }
            return (
              <Typography variant="body2" color="text.secondary">This strategy is not yet configurable in the app.</Typography>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStrategyConfigOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setToast((t) => ({ ...t, open: false }))} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.severity === 'success' && txHash ? (
            <>
              Transaction confirmed.{' '}
              {explorerBase ? (
                <a href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                  View on explorer
                </a>
              ) : null}
            </>
          ) : (
            toast.message
          )}
        </Alert>
      </Snackbar>

      {/* Close Wallet Modal */}
      <Dialog open={closeOpen} onClose={() => setCloseOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Close Wallet</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will pause automation and permanently delete this wallet.
          </Typography>
          {hasAnyFunds ? (
            <Alert severity="warning">Your wallet has funds. Withdraw all your funds before closing your wallet.</Alert>
          ) : (
            <Typography variant="caption" color="text.secondary">
              No funds detected. You can close the wallet safely. <br />
              This will require 2 transactions to complete, one to pause automation and one to unregister your wallet.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={hasAnyFunds}
            onClick={async () => {
              if (!walletAddress) return;
              try {
                let maxFeePerGas: bigint | undefined;
                let maxPriorityFeePerGas: bigint | undefined;
                try {
                  const fees = await client.estimateFeesPerGas();
                  maxFeePerGas = fees.maxFeePerGas;
                  maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? parseUnits('1', 9);
                } catch {}
                const hash = await writeContractAsync({
                  address: walletAddress,
                  abi: powerWalletAbi as any,
                  functionName: 'closeWallet',
                  args: [],
                  ...(maxFeePerGas ? { maxFeePerGas } : {}),
                  ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
                });
                setTxHash(hash as `0x${string}`);
                await client.waitForTransactionReceipt({ hash: hash as `0x${string}` });
                // After closing, request factory to delete the wallet reference
                try {
                  const factory = contractAddresses[chainKey]?.walletFactory as `0x${string}` | undefined;
                  if (factory) {
                    const factoryAbi = [
                      { type: 'function', name: 'deleteWallet', stateMutability: 'nonpayable', inputs: [ { name: 'walletAddr', type: 'address' } ], outputs: [] },
                    ] as const;
                    const delHash = await writeContractAsync({
                      address: factory,
                      abi: factoryAbi as any,
                      functionName: 'deleteWallet',
                      args: [walletAddress],
                      ...(maxFeePerGas ? { maxFeePerGas } : {}),
                      ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
                    });
                    setTxHash(delHash as `0x${string}`);
                  }
                } catch (e) {}
                setCloseOpen(false);
              } catch (e: any) {
                setToast({ open: true, message: e?.shortMessage || e?.message || 'Close failed', severity: 'error' });
              }
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      

      {/* Transactions - Deposits & Withdrawals */}
      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" fontWeight="bold">Deposits & Withdrawals</Typography>
              <TableContainer sx={{ mt: 1, overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 520, whiteSpace: 'nowrap' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Asset</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {((Array.isArray(depositsData) ? depositsData : []).length === 0 && (Array.isArray(withdrawalsData) ? withdrawalsData : []).length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary">No deposits or withdrawals yet.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {[...(Array.isArray(depositsData) ? depositsData : [])].sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp)).map((d: any, idx: number) => (
                      <TableRow key={`dep-${idx}`}>
                        <TableCell>
                          <Tooltip title={formatDateTime(d.timestamp)} placement="top" disableFocusListener disableTouchListener>
                            <span>{formatDateOnly(d.timestamp)}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell>Deposit</TableCell>
                        <TableCell>USDC</TableCell>
                        <TableCell align="right">{formatTokenAmount(d.amount as bigint, 6)}</TableCell>
                      </TableRow>
                    ))}
                    {[...(Array.isArray(withdrawalsData) ? withdrawalsData : [])].sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp)).map((w: any, idx: number) => {
                      const meta = addressToMeta(w.asset as string);
                      const sym = meta?.symbol || `${String(w.asset).slice(0, 6)}…${String(w.asset).slice(-4)}`;
                      return (
                        <TableRow key={`wd-${idx}`}>
                          <TableCell>
                            <Tooltip title={formatDateTime(w.timestamp)} placement="top" disableFocusListener disableTouchListener>
                              <span>{formatDateOnly(w.timestamp)}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell>Withdrawal</TableCell>
                          <TableCell>{sym}</TableCell>
                          <TableCell align="right">{formatTokenAmount(w.amount as bigint, meta?.decimals)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        {/* Transactions - Swaps */}
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" fontWeight="bold">Swaps</Typography>
              <TableContainer sx={{ mt: 1, overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 680, whiteSpace: 'nowrap' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Side</TableCell>
                      <TableCell>Asset</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Price (USDC)</TableCell>
                      <TableCell align="right">Value (USDC)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {((Array.isArray(swapsData) ? swapsData : []).length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Typography variant="body2" color="text.secondary">No swaps yet.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {[...(Array.isArray(swapsData) ? swapsData : [])].sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp)).map((s: any, idx: number) => {
                      const tokenIn = String(s.tokenIn);
                      const tokenOut = String(s.tokenOut);
                      const amountIn = s.amountIn as bigint;
                      const amountOut = s.amountOut as bigint;
                      const tokenInMeta = addressToMeta(tokenIn);
                      const tokenOutMeta = addressToMeta(tokenOut);
                      const isBuy = tokenInMeta?.symbol === 'USDC';
                      const riskMeta = isBuy ? tokenOutMeta : tokenInMeta;
                      const stableDec = (chainAssets as any)['USDC']?.decimals ?? 6;
                      const riskDec = riskMeta?.decimals ?? 18;
                      let priceNum: number | null = null;
                      if (isBuy && riskMeta) {
                        const usdcSold = Number(amountIn) / 10 ** stableDec;
                        const riskBought = Number(amountOut) / 10 ** riskDec;
                        if (riskBought > 0) priceNum = usdcSold / riskBought;
                      } else if (!isBuy && riskMeta) {
                        const usdcBought = Number(amountOut) / 10 ** stableDec;
                        const riskSold = Number(amountIn) / 10 ** riskDec;
                        if (riskSold > 0) priceNum = usdcBought / riskSold;
                      }
                      const amountRisk = isBuy ? (Number(amountOut) / 10 ** riskDec) : (Number(amountIn) / 10 ** riskDec);
                      const valueUsdc = priceNum !== null ? amountRisk * priceNum : null;
                      return (
                        <TableRow key={`sw-${idx}`}>
                          <TableCell>
                            <Tooltip title={formatDateTime(s.timestamp)} placement="top" disableFocusListener disableTouchListener>
                              <span>{formatDateOnly(s.timestamp)}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{isBuy ? 'BUY' : 'SELL'}</TableCell>
                          <TableCell>{riskMeta?.symbol || '-'}</TableCell>
                          <TableCell align="right">{Number.isFinite(amountRisk) ? amountRisk.toLocaleString('en-US', { maximumFractionDigits: 8 }) : '-'}</TableCell>
                          <TableCell align="right">{priceNum !== null ? `$${priceNum.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '-'}</TableCell>
                          <TableCell align="right">{valueUsdc !== null ? `$${valueUsdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Close Wallet Section (below Automation card) */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-start' }}>
        <Button color="error" variant="outlined" onClick={() => setCloseOpen(true)}>Close Wallet</Button>
      </Box>
    </Container>
  );
}


