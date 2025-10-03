'use client';

import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert, CircularProgress } from '@mui/material';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import baseSepoliaAssets from '@/lib/assets/base-sepolia.json';
import { createPublicClient, http } from 'viem';
import { baseSepolia, base } from 'viem/chains';

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
];

const simpleDcaAbi = [
  { type: 'function', name: 'description', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'string' } ] },
  { type: 'function', name: 'frequency', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'dcaAmountStable', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
];

function formatUsd6(v?: bigint) {
  if (!v) return '$0.00';
  const num = Number(v) / 1_000_000;
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WalletDetailsPage() {
  // Support both dynamic route and query param entry
  const params = useParams<{ address?: string }>();
  const sp = useSearchParams();
  const walletAddress = (params?.address as `0x${string}` | undefined) || (sp.get('address') as `0x${string}` | null) || ('0x' as `0x${string}`);
  const chainId = useChainId();
  const { address: connected } = useAccount();
  const getExplorerBase = (id?: number) => {
    if (id === 8453) return 'https://basescan.org';
    if (id === 84532) return 'https://sepolia.basescan.org';
    return '';
  };
  const shortAddress = React.useMemo(() => {
    if (!walletAddress || walletAddress.length < 10) return walletAddress;
    return `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const { data: assets } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'getRiskAssets',
  });
  const { data: balances } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'getBalances',
  });
  const { data: valueUsd } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'getPortfolioValueUSD',
  });
  const { data: strategyAddr } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'strategy',
  });
  const { data: stableTokenAddr } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'stableAsset',
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

  // Helpers to map address -> symbol/decimals/feed
  const chainAssets = baseSepoliaAssets as Record<string, { address: string; symbol: string; decimals: number; feed: `0x${string}` }>;
  const addressToMeta = (addr: string | undefined) => {
    if (!addr) return undefined;
    const lower = addr.toLowerCase();
    const entries = Object.values(chainAssets);
    return entries.find(a => a.address.toLowerCase() === lower);
  };

  const formatTokenAmount = (amount?: bigint, decimals?: number) => {
    if (amount === undefined || decimals === undefined) return '0';
    const base = 10 ** Math.min(decimals, 18);
    const value = Number(amount) / base;
    const fractionDigits = decimals >= 6 ? 4 : decimals;
    return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
  };

  // Public client on current chain
  const client = useMemo(() => createPublicClient({ chain: chainId === 8453 ? base : baseSepolia, transport: http() }), [chainId]);

  const aggregatorAbi = [
    { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
    { type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [], outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ] },
  ] as const;

  const [prices, setPrices] = React.useState<Record<string, { price: number; decimals: number }>>({});
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: 'info' | 'success' | 'error' }>({ open: false, message: '', severity: 'info' });

  // Deposit/Withdraw modals
  const [depositOpen, setDepositOpen] = React.useState(false);
  const [withdrawOpen, setWithdrawOpen] = React.useState(false);
  const [depositAmount, setDepositAmount] = React.useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = React.useState<string>('');
  const [isDepositing, setIsDepositing] = React.useState(false);
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);
  const [allowance, setAllowance] = React.useState<bigint | undefined>(undefined);

  

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
  }, [client]);

  // Refresh allowance when deposit modal opens
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

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>My Wallet</Typography>
      {walletAddress && (
        <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 3 }}>
          <a
            href={`${getExplorerBase(chainId)}/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            {shortAddress}
          </a>
        </Typography>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" fontWeight="bold">Portfolio</Typography>
              <Typography variant="h5" sx={{ mt: 1 }}>{formatUsd6(valueUsd as bigint)}</Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {(() => {
                  const order: string[] = ['cbBTC', 'WETH', 'USDC'];
                  const tiles: React.ReactNode[] = [];
                  for (const sym of order) {
                    const m = (chainAssets as any)[sym] as { address: string; symbol: string; decimals: number; feed?: `0x${string}` } | undefined;
                    if (!m) continue;
                    let amt: bigint | undefined;
                    if (sym === 'USDC') {
                      amt = stableBal;
                    } else {
                      const idx = riskAssets.findIndex(x => x.toLowerCase() === m.address.toLowerCase());
                      if (idx === -1) continue;
                      amt = riskBals[idx];
                    }
                    const p = prices[m.symbol];
                    const usd = p ? (Number(amt || 0) * p.price) / 10 ** (m.decimals + p.decimals - 6) : undefined;
                    tiles.push(
                      <Grid key={sym} item xs={12} sm={6} md={4}>
                        <Stack>
                          <Typography variant="body1" fontWeight="bold">{formatTokenAmount(amt, m.decimals)} {m.symbol}</Typography>
                          <Typography variant="body2" color="text.secondary">{usd !== undefined ? `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</Typography>
                        </Stack>
                      </Grid>
                    );
                  }
                  return tiles;
                })()}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" fontWeight="bold">Strategy</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{String(desc || '')}</Typography>
              <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                <Box>
                  <Typography variant="caption">DCA Amount</Typography>
                  <Typography variant="body1">{formatUsd6(dcaAmount as bigint)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption">Frequency</Typography>
                  <Typography variant="body1">{freq ? `${Number(freq) / 86400} d` : '-'}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button variant="outlined" size="small" onClick={() => setDepositOpen(true)}>Deposit</Button>
                <Button variant="outlined" size="small" onClick={() => setWithdrawOpen(true)}>Withdraw</Button>
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
                // Read allowance & balance; approve if needed
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
                  });
                  setTxHash(approveHash as `0x${string}`);
                  // Wait for approval to be mined before depositing
                  await client.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
                }
                // Send deposit
                const depositHash = await writeContractAsync({
                  address: walletAddress,
                  abi: powerWalletAbi as any,
                  functionName: 'deposit',
                  args: [amt],
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
                const hash = await writeContractAsync({
                  address: walletAddress,
                  abi: powerWalletAbi as any,
                  functionName: 'withdraw',
                  args: [amt],
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
              {getExplorerBase(chainId) ? (
                <a href={`${getExplorerBase(chainId)}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                  View on explorer
                </a>
              ) : null}
            </>
          ) : (
            toast.message
          )}
        </Alert>
      </Snackbar>
    </Container>
  );
}


