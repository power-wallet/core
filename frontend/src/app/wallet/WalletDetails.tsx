'use client';

import React, { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import appConfig from '@/config/appConfig.json';
import { getChainKey } from '@/config/networks';
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
  { type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' } ], outputs: [] },
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

  const riskAssets = (assets as string[] | undefined) || [];
  const stableBal = (balances as any)?.[0] as bigint | undefined;
  const riskBals = ((balances as any)?.[1] as bigint[] | undefined) || [];

  const chainAssets = (appConfig as any)[chainKey]?.assets as Record<string, { address: string; symbol: string; decimals: number; feed: `0x${string}` }>;
  const addressToMeta = React.useCallback((addr: string | undefined) => {
    if (!addr) return undefined;
    const lower = addr.toLowerCase();
    const entries = Object.values(chainAssets);
    return entries.find(a => a.address.toLowerCase() === lower);
  }, [chainAssets]);

  const formatTokenAmount = (amount?: bigint, decimals?: number) => {
    if (amount === undefined || decimals === undefined) return '0';
    const base = 10 ** Math.min(decimals, 18);
    const value = Number(amount) / base;
    const fractionDigits = decimals >= 6 ? 4 : decimals;
    return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
  };

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
  const [isDepositing, setIsDepositing] = React.useState(false);
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);
  const [allowance, setAllowance] = React.useState<bigint | undefined>(undefined);
  const [upkeepId, setUpkeepId] = React.useState<bigint | null | undefined>(undefined);

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

  // Discover Chainlink Automation Upkeep ID on Base Sepolia only
  React.useEffect(() => {
    (async () => {
      if (!walletAddress) return setUpkeepId(undefined);
      if (chainId !== 84532) return setUpkeepId(null); // only supported for Base Sepolia by default
      try {
        const id = await findUpkeepIdForTarget(walletAddress as `0x${string}`, { chainId });
        setUpkeepId(id);
      } catch {
        setUpkeepId(null);
      }
    })();
  }, [walletAddress, chainId]);

  if (!walletAddress) return null;

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>My Wallet</Typography>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 3 }}>
        <a
          href={`${explorerBase}/address/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'underline' }}
        >
          {shortAddress}
        </a>
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                      <Box key={sym} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          {formatTokenAmount(amt, m.decimals)} {m.symbol}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
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
                <Grid container spacing={2} sx={{ mt: 1 }} alignItems="flex-start">
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
                          <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '1.1rem' }}>
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
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" fontWeight="bold">Strategy</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{String(desc || '')}</Typography>
              <Stack direction="row" spacing={3} sx={{ mt: 2, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption">DCA Amount</Typography>
                  <Typography variant="body1">{formatUsd6(dcaAmount as bigint)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption">Frequency</Typography>
                  <Typography variant="body1">{freq ? `${Number(freq) / 86400} d` : '-'}</Typography>
                </Box>
                {strategyAddr ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Strategy Contract</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      <a
                        href={`${explorerBase}/address/${strategyAddr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', textDecoration: 'underline' }}
                      >
                        {`${String(strategyAddr).slice(0, 6)}…${String(strategyAddr).slice(-4)}`}
                      </a>
                    </Typography>
                  </Box>
                ) : null}
              </Stack>
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
            Allowance: {formatTokenAmount(allowance, 6)} USDC
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

      {/* Withdraw Modal */}
      <Dialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Withdraw USDC</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Amount (USDC)"
            type="number"
            fullWidth
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            inputProps={{ min: 0, step: '0.01' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              if (!walletAddress) return;
              const amount = Math.max(0, Number(withdrawAmount || '0'));
              if (amount <= 0) return;
              const amt = BigInt(Math.round(amount * 1_000_000));
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
                  functionName: 'withdraw',
                  args: [amt],
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

      {/* Chainlink Automation CTA */}
      <Box sx={{ mt: 6, textAlign: 'left' }}>
        <Typography variant="subtitle1" fontWeight="bold">Automate Your Wallet</Typography>
        {upkeepId === undefined ? (
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
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              Register a Chainlink Automation Upkeep for this wallet.
            </Typography>
            <Button
              variant="outlined"
              href="https://automation.chain.link/base-sepolia"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Chainlink Automation
            </Button>
          </>
        )}
      </Box>
    </Container>
  );
}


