'use client';

import React from 'react';
import { Box, Stack, TextField, Button, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
import { useWriteContract } from 'wagmi';
import { createPublicClient, http, parseUnits } from 'viem';
import { writeWithFees } from '@/lib/tx';
import { getViemChain, getChainKey } from '@/config/networks';
import { ensureOnPrimaryChain } from '@/lib/web3';
import appConfig from '@/config/appConfig.json';

type Props = {
  strategyAddr: `0x${string}`;
  chainId: number;
  stableSymbol: string; // e.g., USDC
  stableDecimals: number; // e.g., 6
  initialAmountStable?: bigint; // 6-decimal USDC
  initialFrequency?: bigint; // seconds
};

const SIMPLE_DCA_ABI = [
  { type: 'function', name: 'setDcaAmountStable', stateMutability: 'nonpayable', inputs: [{ name: 'newAmount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setFrequency', stateMutability: 'nonpayable', inputs: [{ name: 'newFrequency', type: 'uint256' }], outputs: [] },
] as const;

export default function ConfigSimpleDcaV1({ strategyAddr, chainId, stableSymbol, stableDecimals, initialAmountStable, initialFrequency }: Props) {
  const [amount, setAmount] = React.useState<string>(() => {
    if (!initialAmountStable) return '';
    const s = initialAmountStable.toString();
    if (stableDecimals === 0) return s;
    if (s.length > stableDecimals) {
      const whole = s.slice(0, s.length - stableDecimals);
      const frac = s.slice(s.length - stableDecimals).replace(/0+$/, '');
      return frac ? `${whole}.${frac}` : whole;
    }
    return `0.${'0'.repeat(stableDecimals - s.length)}${s}`;
  });
  const [days, setDays] = React.useState<string>(() => {
    if (!initialFrequency) return '';
    const d = Math.max(1, Math.round(Number(initialFrequency) / 86400));
    return String(d);
  });
  const [busy, setBusy] = React.useState<null | 'amount' | 'freq'>(null);
  const { writeContractAsync } = useWriteContract();
  const cfg = (appConfig as any)[getChainKey(chainId)];
  const client = React.useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http(cfg?.rpcUrl) }), [chainId, cfg?.rpcUrl]);
  const explorerBase = (appConfig as any)[getChainKey(chainId)]?.explorer as string | undefined;
  const [toast, setToast] = React.useState<{ open: boolean; hash?: `0x${string}` }>(() => ({ open: false }));

  const onUpdateAmount = async () => {
    // Do not auto-switch here; rely on global prompt and explicit actions elsewhere
    const v = Math.max(0, Number(amount || '0'));
    if (!isFinite(v)) return;
    const scaled = parseUnits(String(v), stableDecimals);
    setBusy('amount');
    try {
      const hash = await writeWithFees({ write: writeContractAsync as any, client, address: strategyAddr, abi: SIMPLE_DCA_ABI as any, functionName: 'setDcaAmountStable', args: [scaled] });
      await client.waitForTransactionReceipt({ hash });
      setToast({ open: true, hash });
    } finally {
      setBusy(null);
    }
  };

  const onUpdateFrequency = async () => {
    // Do not auto-switch here; rely on global prompt and explicit actions elsewhere
    const d = Math.floor(Number(days || '0'));
    if (!Number.isInteger(d) || d < 1 || d > 31) return;
    const seconds = BigInt(d * 86400);
    setBusy('freq');
    try {
      const hash = await writeWithFees({ write: writeContractAsync as any, client, address: strategyAddr, abi: SIMPLE_DCA_ABI as any, functionName: 'setFrequency', args: [seconds] });
      await client.waitForTransactionReceipt({ hash });
      setToast({ open: true, hash });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
    <Stack spacing={2} sx={{ mt: 1 }}>
      <Box>
        <Typography variant="caption">DCA Amount ({stableSymbol})</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            size="small"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputProps={{ min: 0, step: '0.01' }}
            sx={{ maxWidth: 260 }}
          />
          <Button variant="outlined" size="small" onClick={onUpdateAmount} disabled={busy === 'amount'}>
            {busy === 'amount' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
          </Button>
        </Stack>
      </Box>
      <Box>
        <Typography variant="caption">DCA Cadence (days)</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            size="small"
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            inputProps={{ min: 1, max: 31, step: 1 }}
            sx={{ maxWidth: 200 }}
            helperText="1–31 days"
          />
          <Button variant="outlined" size="small" onClick={onUpdateFrequency} disabled={busy === 'freq'}>
            {busy === 'freq' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
          </Button>
        </Stack>
      </Box>
    </Stack>
    <Snackbar
      open={toast.open}
      autoHideDuration={6000}
      onClose={() => setToast({ open: false, hash: undefined })}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={() => setToast({ open: false, hash: undefined })} severity="success" sx={{ width: '100%' }}>
        Transaction confirmed.{' '}
        {toast.hash && explorerBase ? (
          <a href={`${explorerBase}/tx/${toast.hash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
            View on explorer
          </a>
        ) : null}
      </Alert>
    </Snackbar>
    </>
  );
}


