'use client';

import React, { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Container, Grid, Typography, Snackbar, Alert, useMediaQuery, useTheme, Tooltip } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { useAccount, useReadContract, useChainId } from 'wagmi';
import WalletHistoryChart from './charts/WalletHistoryChart';
import { buildWalletHistorySeries } from '@/lib/walletHistory';
import { powerWalletAbi, FEED_ABI } from '@/lib/abi';
import { useWalletReads, useStrategyReads } from '@/lib/walletReads';
import { formatTokenAmountBigint } from '@/lib/format';
import AssetsCard from './components/AssetsCard';
import StrategyCard from './components/StrategyCard';
import WalletConfigCard from './components/WalletConfigCard';
import DepositsWithdrawalsCard from './components/DepositsWithdrawalsCard';
import SwapsCard from './components/SwapsCard';
import DepositDialog from './components/DepositDialog';
import WithdrawDialog from './components/WithdrawDialog';
import SlippageDialog from './components/SlippageDialog';
import CloseWalletDialog from './components/CloseWalletDialog';
import StrategyConfigDialog from './components/StrategyConfigDialog';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import appConfig from '@/config/appConfig.json';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import { getChainKey } from '@/config/networks';
import { ensureOnPrimaryChain } from '@/lib/web3';
import { createPublicClient, http, parseUnits } from 'viem';
import { writeWithFees } from '@/lib/tx';
import { getViemChain } from '@/config/networks';


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
  const [copied, setCopied] = React.useState(false);

  const {
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
  } = useWalletReads(walletAddress);

  const { dcaAmount, baseDcaAmount, freq, desc, strategyName, strategyIdStr } = useStrategyReads(strategyAddr as any);

  // Transactions moved into useWalletReads

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

  const formatTokenAmount = formatTokenAmountBigint;

  const formatAllowance = (amount?: bigint) => formatTokenAmount(amount, 6);

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
  const { data: userUsdcBalance, refetch: refetchUserUsdc } = useReadContract({
    address: (stableTokenAddr as `0x${string}`) || undefined,
    abi: [
      { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    ] as const,
    functionName: 'balanceOf',
    args: connected ? [connected as `0x${string}`] : undefined,
    query: { enabled: Boolean(stableTokenAddr && connected), refetchInterval: 60000 },
  });

  const client = useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http() }), [chainId]);

  // Use shared Chainlink feed ABI

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
  const [slippageOpen, setSlippageOpen] = React.useState(false);
  const [slippageInput, setSlippageInput] = React.useState<string>('');
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [strategyConfigOpen, setStrategyConfigOpen] = React.useState(false);

  // createdAt now provided by useWalletReads

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
        // Discover any risk token addresses referenced in events but not in getRiskAssets
        const eventRiskAddrSet = new Set<`0x${string}`>();
        for (const s of swaps) {
          const inIsStable = s.tokenIn.toLowerCase() === (stableTokenAddr as string).toLowerCase();
          const outIsStable = s.tokenOut.toLowerCase() === (stableTokenAddr as string).toLowerCase();
          if (!inIsStable) eventRiskAddrSet.add(s.tokenIn);
          if (!outIsStable) eventRiskAddrSet.add(s.tokenOut);
        }
        const riskAddrSet = new Set(riskAssets.map((a) => a.toLowerCase()));
        const missingEventRisks = Array.from(eventRiskAddrSet).filter((a) => !riskAddrSet.has(a.toLowerCase()));
        const extraRiskMetas = missingEventRisks.map((a) => addressToMeta(a)).filter(Boolean) as { address: string; symbol: string; decimals: number; feed: `0x${string}` }[];
        const allRiskMetas = [...riskMetas, ...extraRiskMetas].filter((m, idx, arr) => arr.findIndex(x => x.address.toLowerCase() === m.address.toLowerCase()) === idx);

        const series = await buildWalletHistorySeries({
          createdAt: createdAtTs as bigint,
          stable: { address: (stableTokenAddr as `0x${string}`)!, symbol: stableMeta.symbol, decimals: stableMeta.decimals },
          risks: allRiskMetas.map(r => ({ address: r.address as `0x${string}`, symbol: r.symbol, decimals: r.decimals })),
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
      // After confirmation, refetch key wallet data (with a brief delay to allow RPC/state propagation)
      setTimeout(() => {
        try { refetchBalances?.(); } catch { }
        try { refetchValueUsd?.(); } catch { }
        try { refetchDeposits?.(); } catch { }
        try { refetchWithdrawals?.(); } catch { }
        try { refetchSwaps?.(); } catch { }
        try { refetchUserUsdc?.(); } catch { }
      }, 1200);
    }
  }, [isConfirmed, txHash, refetchBalances, refetchValueUsd, refetchDeposits, refetchWithdrawals, refetchSwaps, refetchUserUsdc]);

  React.useEffect(() => {
    let cancelled = false;
    const metas = [addressToMeta(chainAssets.cbBTC.address), addressToMeta(chainAssets.WETH.address), addressToMeta(chainAssets.USDC.address)].filter(Boolean) as { address: string; symbol: string; decimals: number; feed: `0x${string}` }[];

    const load = async () => {
      const next: Record<string, { price: number; decimals: number }> = {};
      for (const m of metas) {
        try {
          const [dec, round] = await Promise.all([
            client.readContract({ address: m.feed, abi: FEED_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
            client.readContract({ address: m.feed, abi: FEED_ABI as any, functionName: 'latestRoundData', args: [] }) as Promise<any>,
          ]);
          const p = Number(round[1]);
          next[m.symbol] = { price: p, decimals: dec };
        } catch (e) { }
      }
      if (!cancelled) setPrices(next);
    };

    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [client, addressToMeta, chainAssets.cbBTC.address, chainAssets.WETH.address, chainAssets.USDC.address]);

  React.useEffect(() => {
    (async () => {
      if (!depositOpen || !stableTokenAddr || !walletAddress || !connected) return;
      try {
        const erc20ReadAbi = [
          { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
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
  // Removed Chainlink Automation Upkeep discovery effect

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
  <Box sx={{ bgcolor: 'background.default', minHeight: '60vh' }}>

    <Container maxWidth="lg" sx={{ py: 3 }}>
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
        <Tooltip title="Copy address">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); if (walletAddress) navigator.clipboard.writeText(walletAddress).then(() => setCopied(true)).catch(() => { }); }}
            style={{ color: 'inherit', marginLeft: 6, display: 'inline-flex', alignItems: 'center' }}
            aria-label="Copy wallet address"
          >
            <ContentCopyIcon sx={{ fontSize: 14 }} />
          </a>
        </Tooltip>
        <Tooltip title="Open in block explorer">
          <a
            href={`${explorerBase}/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', marginLeft: 6, display: 'inline-flex', alignItems: 'center' }}
            aria-label="Open on block explorer"
          >
            <LaunchIcon sx={{ fontSize: 14 }} />
          </a>
        </Tooltip>
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
        <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column' }}>
          <AssetsCard
            chainAssets={chainAssets as any}
            riskAssets={riskAssets as any}
            stableBal={stableBal}
            riskBals={riskBals}
            userUsdcBalance={userUsdcBalance}
            prices={prices}
            valueUsd={valueUsd as bigint}
            onDeposit={() => setDepositOpen(true)}
            onWithdraw={() => setWithdrawOpen(true)}
          />
        </Grid>

        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <StrategyCard
            strategyName={(() => {
              const strategies = (appConfig as any)[chainKey]?.strategies || {};
              const onChainId = String(strategyIdStr || '').trim();
              let mappedName: string | null = null;
              if (onChainId && (strategies as any)[onChainId]?.name) {
                mappedName = (strategies as any)[onChainId].name as string;
              } else if (onChainId) {
                for (const st of Object.values<any>(strategies)) {
                  if (String(st.id || '').trim() === onChainId) { mappedName = (st as any).name as string; break; }
                }
              }
              return mappedName || String(strategyName || '');
            })() as any}
            description={(() => {
              const strategies = (appConfig as any)[chainKey]?.strategies || {};
              const onChainId = String(strategyIdStr || '').trim();
              let mappedDesc: string | null = null;
              if (onChainId && (strategies as any)[onChainId]?.description) {
                mappedDesc = (strategies as any)[onChainId].description as string;
              } else if (onChainId) {
                for (const st of Object.values<any>(strategies)) {
                  if (String(st.id || '').trim() === onChainId) { mappedDesc = (st as any).description as string; break; }
                }
              }
              const finalDesc = mappedDesc || String(desc || '');
              return finalDesc;
            })()}
            strategyAddr={strategyAddr as any}
            explorerBase={explorerBase}
            dcaAmount={(["power-btc-dca-v1", "smart-btc-dca-v2"].includes(String(strategyIdStr || '').trim()) ? baseDcaAmount : dcaAmount) as any}
            frequency={freq as any}
            strategyIdStr={strategyIdStr as any}
            onOpenConfig={() => setStrategyConfigOpen(true)}
          />
        </Grid>
      </Grid>

      {/* Wallet Config + Automate Your Wallet side by side on desktop */}
      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <WalletConfigCard
            automationPaused={automationPaused as any}
            slippage={slippage as any}
            onOpenSlippage={() => { setSlippageInput(slippage ? String(Number(slippage)) : ''); setSlippageOpen(true); }}
            onToggleAutomation={async () => {
              const ok = await ensureOnPrimaryChain(chainId as number, (args: any) => (window as any));
              if (!walletAddress) return;
              try {
                const fn = automationPaused ? 'unpauseAutomation' : 'pauseAutomation';
                const hash = await writeWithFees({ write: writeContractAsync as any, client, address: walletAddress, abi: powerWalletAbi as any, functionName: fn as any, args: [] });
                setTxHash(hash as `0x${string}`);
              } catch (e: any) {
                setToast({ open: true, message: e?.shortMessage || e?.message || 'Transaction failed', severity: 'error' });
              }
            }}
          />
        </Grid>

        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <DepositsWithdrawalsCard
            deposits={(Array.isArray(depositsData) ? depositsData : []) as any}
            withdrawals={(Array.isArray(withdrawalsData) ? withdrawalsData : []) as any}
            addressToMeta={addressToMeta as any}
          />
        </Grid>
      </Grid>

      {/* Deposit Modal */}
      <DepositDialog
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        amount={depositAmount}
        onChangeAmount={setDepositAmount}
        userUsdcBalance={(userUsdcBalance as bigint) ?? userStableBalance}
        allowance={allowance}
        isSubmitting={isDepositing}
        onSubmit={async () => {
          if (!stableTokenAddr || !walletAddress) return;
          const amount = Math.max(0, Number(depositAmount || '0'));
          if (amount <= 0) return;
          const amt = BigInt(Math.round(amount * 1_000_000));
          setIsDepositing(true);
          try {
            const erc20ReadAbi = [
              { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
              { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
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
                { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
              ] as const;
              const approveHash = await writeWithFees({ write: writeContractAsync as any, client, address: stableTokenAddr as `0x${string}`, abi: erc20WriteAbi as any, functionName: 'approve', args: [walletAddress, amt] });
              setTxHash(approveHash as `0x${string}`);
              await client.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
            }
            const depositHash = await writeWithFees({ write: writeContractAsync as any, client, address: walletAddress, abi: powerWalletAbi as any, functionName: 'deposit', args: [amt] });
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
      />

      {/* Update Slippage Modal */}
      <SlippageDialog
        open={slippageOpen}
        onClose={() => setSlippageOpen(false)}
        slippage={Number(slippage ?? 0)}
        onChange={setSlippageInput}
        onSubmit={async () => {
          if (!walletAddress) return;
          const val = Math.max(0, Math.floor(Number(slippageInput || '0')));
          if (Number.isNaN(val) || val >= 5000) {
            setToast({ open: true, message: 'Enter a value below 5000', severity: 'error' });
            return;
          }
          try {
            const hash = await writeWithFees({ write: writeContractAsync as any, client, address: walletAddress, abi: powerWalletAbi as any, functionName: 'setSlippageBps', args: [val] });
            setTxHash(hash as `0x${string}`);
            await client.waitForTransactionReceipt({ hash: hash as `0x${string}` });
            await refetchSlippage();
            setSlippageOpen(false);
          } catch (e: any) {
            setToast({ open: true, message: e?.shortMessage || e?.message || 'Update failed', severity: 'error' });
          }
        }}
      />

      {/* Withdraw Modal */}
      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        withdrawAssetAddr={withdrawAssetAddr}
        onChangeAsset={(addr) => setWithdrawAssetAddr(addr)}
        withdrawAmount={withdrawAmount}
        onChangeAmount={setWithdrawAmount}
        stableTokenAddr={stableTokenAddr as any}
        riskAssets={riskAssets as any}
        stableBal={stableBal}
        riskBals={riskBals}
        addressToMeta={addressToMeta as any}
        isSubmitting={isWithdrawing}
        onSubmit={async () => {
          if (!walletAddress || !withdrawAssetAddr) return;
          const amount = Math.max(0, Number(withdrawAmount || '0'));
          if (amount <= 0) return;
          const meta = addressToMeta(withdrawAssetAddr);
          const decimals = meta?.decimals ?? 6;
          const scale = Math.pow(10, Math.min(decimals, 18));
          const amt = BigInt(Math.round(amount * scale));
          setIsWithdrawing(true);
          try {
            const hash = await writeWithFees({ write: writeContractAsync as any, client, address: walletAddress, abi: powerWalletAbi as any, functionName: 'withdrawAsset', args: [withdrawAssetAddr, amt] });
            setTxHash(hash as `0x${string}`);
            setWithdrawOpen(false);
            setWithdrawAmount('');
          } catch (e) {
            setToast({ open: true, message: 'Withdraw failed', severity: 'error' });
          } finally {
            setIsWithdrawing(false);
          }
        }}
      />

      {/* Strategy Config Modal */}
      {(() => {
        const strategies = (appConfig as any)[chainKey]?.strategies || {};
        const descStr = String(desc || '').trim();
        let matchedId: string | null = null;
        let stableKey: string | null = null;
        const onChainId = String(strategyIdStr || '').trim();
        if (onChainId && strategies[onChainId]) {
          matchedId = onChainId;
          stableKey = (strategies as any)[onChainId].stable;
        } else if (onChainId) {
          for (const [id, st] of Object.entries<any>(strategies)) {
            if (String((st as any).id || '').trim() === onChainId) {
              matchedId = id;
              stableKey = (st as any).stable; break;
            }
          }
        }

        const content = matchedId === 'simple-btc-dca-v1' ? 'simple' :
            ['btc-dca-power-law-v1', 'power-btc-dca-v2'].includes(matchedId ?? '') ? 'power' :
            ['power-btc-dca-v1', 'smart-btc-dca-v2'].includes(matchedId ?? '') ? 'smart' :
            (matchedId === 'trend-btc-dca-v1' ? 'trend' : 'unknown');

        const stableMeta = stableKey ? (appConfig as any)[chainKey].assets[Object.keys((appConfig as any)[chainKey].assets).find(k => k.toLowerCase() === String(stableKey).toLowerCase()) as string] : null;
        return (
          <StrategyConfigDialog
            open={strategyConfigOpen}
            onClose={() => setStrategyConfigOpen(false)}
            isMobile={isMobile}
            chainId={chainId}
            content={content as any}
            strategyAddr={String(strategyAddr || '') as `0x${string}`}
            dcaAmount={dcaAmount as any}
            freq={freq as any}
            stableSymbol={stableMeta?.symbol || 'USDC'}
            stableDecimals={stableMeta?.decimals ?? 6}
          />
        );
      })()}

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

      {/* Copied indicator */}
      <Snackbar
        open={copied}
        autoHideDuration={1500}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setCopied(false)} severity="success" sx={{ width: '100%' }}>
          Address copied to clipboard
        </Alert>
      </Snackbar>

      {/* Close Wallet Modal */}
      <CloseWalletDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        hasAnyFunds={hasAnyFunds}
        onConfirm={async () => {
          if (!walletAddress) return;
          try {
            const hash = await writeWithFees({ write: writeContractAsync as any, client, address: walletAddress, abi: powerWalletAbi as any, functionName: 'closeWallet', args: [] });
            setTxHash(hash as `0x${string}`);
            await client.waitForTransactionReceipt({ hash: hash as `0x${string}` });
            // After closing, request factory to delete the wallet reference
            try {
              const factory = contractAddresses[chainKey]?.walletFactory as `0x${string}` | undefined;
              if (factory) {
                const factoryAbi = [
                  { type: 'function', name: 'deleteWallet', stateMutability: 'nonpayable', inputs: [{ name: 'walletAddr', type: 'address' }], outputs: [] },
                ] as const;
                const delHash = await writeWithFees({ write: writeContractAsync as any, client, address: factory, abi: factoryAbi as any, functionName: 'deleteWallet', args: [walletAddress] });
                setTxHash(delHash as `0x${string}`);
              }
            } catch (e) { }
            setCloseOpen(false);
          } catch (e: any) {
            setToast({ open: true, message: e?.shortMessage || e?.message || 'Close failed', severity: 'error' });
          }
        }}
      />


      {/* Transactions - Deposits & Withdrawals */}
      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12} sx={{ display: 'flex' }}>
          <SwapsCard
            swaps={(Array.isArray(swapsData) ? swapsData : []) as any}
            addressToMeta={addressToMeta as any}
            chainAssets={chainAssets as any}
          />
        </Grid>
      </Grid>

      {/* Close Wallet Section */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-start' }}>
        <Button color="error" variant="outlined" onClick={() => setCloseOpen(true)}>Close Wallet</Button>
      </Box>
    </Container>
  </Box>
  );
}


