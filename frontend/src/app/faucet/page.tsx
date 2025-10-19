'use client';

import React from 'react';
import { Container, Box, Typography, Card, CardContent, Stack, TextField, Button, Alert, Snackbar, CircularProgress, IconButton, Tooltip } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import BaseSepoliaFaucets from '@/components/BaseSepoliaFaucets';
import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import { createPublicClient, http, parseUnits } from 'viem';
import { writeWithFees } from '@/lib/tx';
import { getChainKey, getViemChain } from '@/config/networks';
import { FAUCET_ABI, ERC20_READ_ABI, ERC20_WRITE_ABI } from '@/lib/abi';
import appConfig from '@/config/appConfig.json';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import { formatTokenAmountBigint } from '@/lib/format';

// ABIs moved to lib/abi.ts

function formatToken(amount?: bigint, decimals?: number) {
  if (amount === undefined || decimals === undefined) return '0';
  if (amount === BigInt(0)) return '0';
  const s = amount.toString();
  if (decimals === 0) return s;
  if (s.length > decimals) {
    const whole = s.slice(0, s.length - decimals);
    const frac = s.slice(s.length - decimals).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole;
  } else {
    const zeros = '0'.repeat(decimals - s.length);
    const frac = `${zeros}${s}`.replace(/0+$/, '');
    return frac ? `0.${frac}` : '0';
  }
}

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chainKey = getChainKey(chainId);
  const addr = contractAddresses[chainKey];
  const FAUCET = String(addr?.faucet || '');
  const explorerBase = (appConfig as any)[chainKey]?.explorer as string | undefined;
  const client = React.useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http() }), [chainId]);
  const { writeContractAsync } = useWriteContract();

  const { data: totalClaimed } = useReadContract({
    address: FAUCET as `0x${string}`,
    abi: FAUCET_ABI as any,
    functionName: 'totalClaimed',
    query: { enabled: Boolean(FAUCET), refetchInterval: 30000 },
  });
  const { data: totalClaimedBy } = useReadContract({
    address: FAUCET as `0x${string}`,
    abi: FAUCET_ABI as any,
    functionName: 'totalClaimedBy',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(FAUCET && address), refetchInterval: 30000 },
  });
  const { data: usdcAddr } = useReadContract({
    address: FAUCET as `0x${string}`,
    abi: FAUCET_ABI as any,
    functionName: 'usdc',
    query: { enabled: Boolean(FAUCET), refetchInterval: 60000 },
  });
  const { data: maxClaim } = useReadContract({
    address: FAUCET as `0x${string}`,
    abi: FAUCET_ABI as any,
    functionName: 'maxClaim',
    query: { enabled: Boolean(FAUCET), refetchInterval: 60000 },
  });
  const { data: cooldownSec } = useReadContract({
    address: FAUCET as `0x${string}`,
    abi: FAUCET_ABI as any,
    functionName: 'claimCooldown',
    query: { enabled: Boolean(FAUCET), refetchInterval: 60000 },
  });
  const { data: lastClaimAt } = useReadContract({
    address: FAUCET as `0x${string}`,
    abi: FAUCET_ABI as any,
    functionName: 'lastClaimAt',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(FAUCET && address), refetchInterval: 60000 },
  });

  const [usdcBalance, setUsdcBalance] = React.useState<bigint | undefined>(undefined);
  const [usdcDecimals, setUsdcDecimals] = React.useState<number>(6);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!usdcAddr) return;
      try {
        const [bal, dec] = await Promise.all([
          client.readContract({ address: usdcAddr as `0x${string}`, abi: ERC20_READ_ABI as any, functionName: 'balanceOf', args: [FAUCET as `0x${string}`] }) as Promise<bigint>,
          client.readContract({ address: usdcAddr as `0x${string}`, abi: ERC20_READ_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
        ]);
        if (!cancelled) { setUsdcBalance(bal); setUsdcDecimals(Number(dec)); }
      } catch {}
    })();
    const id = setInterval(async () => {
      if (!usdcAddr) return;
      try {
        const bal = await client.readContract({ address: usdcAddr as `0x${string}`, abi: ERC20_READ_ABI as any, functionName: 'balanceOf', args: [FAUCET as `0x${string}`] }) as bigint;
        if (!cancelled) setUsdcBalance(bal);
      } catch {}
    }, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [client, usdcAddr, FAUCET]);

  const [amount, setAmount] = React.useState<string>('');
  const [donateAmount, setDonateAmount] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);
  const [busyDonate, setBusyDonate] = React.useState(false);
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: 'info' | 'success' | 'error' }>({ open: false, message: '', severity: 'info' });

  const canUse = isConnected && chainId === 84532 && FAUCET;

  const onClaim = async () => {
    if (!canUse) return;
    const v = Math.max(0, Number(amount || '0'));
    if (!isFinite(v) || v <= 0) { setToast({ open: true, message: 'Enter a valid amount', severity: 'error' }); return; }
    const scaled = parseUnits(String(v), usdcDecimals);
    // Optional: enforce maxClaim on the client for UX, but final check is on-chain
    if (typeof maxClaim === 'bigint' && scaled > maxClaim) {
      setToast({ open: true, message: 'Amount exceeds faucet max', severity: 'error' });
      return;
    }
    setBusy(true);
    try {
      const hash = await writeWithFees({
        write: writeContractAsync as any,
        client,
        address: FAUCET as `0x${string}`,
        abi: FAUCET_ABI as any,
        functionName: 'claim',
        args: [scaled],
      });
      await client.waitForTransactionReceipt({ hash });
      setToast({ open: true, message: 'Claim confirmed', severity: 'success' });
      setAmount('');
    } catch (e: any) {
      setToast({ open: true, message: e?.shortMessage || e?.message || 'Claim failed', severity: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const [myUsdcBalance, setMyUsdcBalance] = React.useState<bigint | undefined>(undefined);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!usdcAddr || !address) return;
      try {
        const [bal] = await Promise.all([
          client.readContract({ address: usdcAddr as `0x${string}`, abi: ERC20_READ_ABI as any, functionName: 'balanceOf', args: [address as `0x${string}`] }) as Promise<bigint>,
        ]);
        if (!cancelled) setMyUsdcBalance(bal);
      } catch {}
    })();
    const id = setInterval(async () => {
      if (!usdcAddr || !address) return;
      try {
        const bal = await client.readContract({ address: usdcAddr as `0x${string}`, abi: ERC20_READ_ABI as any, functionName: 'balanceOf', args: [address as `0x${string}`] }) as bigint;
        if (!cancelled) setMyUsdcBalance(bal);
      } catch {}
    }, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [client, usdcAddr, address]);

  const onDonate = async () => {
    if (!canUse) return;
    const v = Math.max(0, Number(donateAmount || '0'));
    if (!isFinite(v) || v <= 0) { setToast({ open: true, message: 'Enter a valid amount to donate', severity: 'error' }); return; }
    const scaled = parseUnits(String(v), usdcDecimals);
    if (typeof myUsdcBalance === 'bigint' && scaled > myUsdcBalance) {
      setToast({ open: true, message: 'Amount exceeds your USDC balance', severity: 'error' });
      return;
    }
    setBusyDonate(true);
    try {
      const hash = await writeWithFees({
        write: writeContractAsync as any,
        client,
        address: usdcAddr as `0x${string}`,
        abi: ERC20_WRITE_ABI as any,
        functionName: 'transfer',
        args: [FAUCET as `0x${string}`, scaled],
      });
      await client.waitForTransactionReceipt({ hash });
      setToast({ open: true, message: 'Donation confirmed. Thank you!', severity: 'success' });
      setDonateAmount('');
    } catch (e: any) {
      setToast({ open: true, message: e?.shortMessage || e?.message || 'Donation failed', severity: 'error' });
    } finally {
      setBusyDonate(false);
    }
  };

  const nextClaimIn = React.useMemo(() => {
    try {
      const last = Number(lastClaimAt || 0);
      const cd = Number(cooldownSec || 0);
      if (!last || !cd) return 0;
      const now = Math.floor(Date.now() / 1000);
      const remain = last + cd - now;
      return Math.max(0, remain);
    } catch { return 0; }
  }, [lastClaimAt, cooldownSec]);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '60vh'}}>
      <Container maxWidth="sm" sx={{ py: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">Testnet Faucet</Typography>
          <Typography variant="body1" color="text.secondary">Claim testnet USDC on Base Sepolia - For Power Wallet users only.</Typography>
        </Box>

        {!canUse ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Connect your wallet on Base Sepolia to use the faucet.
          </Alert>
        ) : null}

        <Stack spacing={2}>

          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mb: 0 }}>Faucet Status</Typography>
                {explorerBase && FAUCET ? (
                  <Tooltip title="View on block explorer">
                    <IconButton
                      size="small"
                      component="a"
                      href={`${explorerBase}/address/${FAUCET}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open faucet in block explorer"
                      sx={{ color: 'primary.main' }}
                    >
                      <OpenInNewIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Box>
              <Stack spacing={0.5}>
                <Typography variant="body2">Faucet Balance: {formatTokenAmountBigint(usdcBalance, usdcDecimals)} USDC</Typography>
                <Typography variant="body2">Total Claimed: {formatTokenAmountBigint(totalClaimed as bigint | undefined, usdcDecimals)} USDC</Typography>
                <Typography variant="body2">My Total Claimed: {formatTokenAmountBigint(totalClaimedBy as bigint | undefined, usdcDecimals)} USDC</Typography>
                {nextClaimIn > 0 ? (
                  <Typography variant="body2" color="text.secondary">Next claim available in ~{Math.ceil(nextClaimIn/60)} min</Typography>
                ) : null}
              </Stack>

            </CardContent>
          </Card>

          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent sx={{ px: 3 }}>
              <Typography sx={{ pt: 1 }} variant="h6" fontWeight="bold" gutterBottom>Claim</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField
                  size="small"
                  type="number"
                  label="Amount (USDC)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputProps={{ min: 0, step: '0.01' }}
                  sx={{  }}
                />
                <Button variant="contained" onClick={onClaim} disabled={!canUse || busy || nextClaimIn > 0}>
                  {busy ? (<><CircularProgress size={16} sx={{ mr: 1 }} /> Claiming…</>) : 'Claim'}
                </Button>

              </Stack>
              {typeof maxClaim === 'bigint' ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Max per claim: {formatToken(maxClaim as bigint, usdcDecimals)} USDC - Be kind to others.
                </Typography>
              ) : null}

              <Typography sx={{ pt: 4 }} variant="h6" fontWeight="bold" gutterBottom>Donate</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField
                  size="small"
                  type="number"
                  label="Donate Amount (USDC)"
                  value={donateAmount}
                  onChange={(e) => setDonateAmount(e.target.value)}
                  inputProps={{ min: 0, step: '0.01' }}
                />
                <Button variant="outlined" onClick={onDonate} disabled={!canUse || busyDonate}>
                  {busyDonate ? (<><CircularProgress size={16} sx={{ mr: 1 }} /> Donating…</>) : 'Donate'}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Your USDC balance: {formatTokenAmountBigint(myUsdcBalance, usdcDecimals)} USDC
              </Typography>
            </CardContent>
          </Card>

          {chainId === 84532 ? (
            <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
              <CardContent sx={{ p: 3 }}>
                <BaseSepoliaFaucets />
              </CardContent>
            </Card>
          ) : null}
        </Stack>

        <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={() => setToast((t) => ({ ...t, open: false }))} severity={toast.severity} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}


