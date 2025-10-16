'use client';

import React from 'react';
import { Box, Stack, TextField, Button, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
import { useWriteContract, useReadContract } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { writeWithFees } from '@/lib/tx';
import { getViemChain } from '@/config/networks';
import appConfig from '@/config/appConfig.json';

type Props = { strategyAddr: `0x${string}`; chainId: number; };

const READ_ABI = [
  { type: 'function', name: 'frequency', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'smaLength', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'hystBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'slopeLookbackDays', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'dcaPctBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'discountBelowSmaPct', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'dcaBoostMultiplier', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  { type: 'function', name: 'minCashStable', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'minSpendStable', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

const WRITE_ABI = [
  { type: 'function', name: 'setFrequency', stateMutability: 'nonpayable', inputs: [{ name: 'newFrequency', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'setSmaParams', stateMutability: 'nonpayable', inputs: [{ name: 'newSmaLen', type: 'uint16' }, { name: 'newHystBps', type: 'uint16' }, { name: 'newSlopeLookback', type: 'uint16' }], outputs: [] },
  { type: 'function', name: 'setDcaParams', stateMutability: 'nonpayable', inputs: [
    { name: 'newDcaPctBps', type: 'uint16' },
    { name: 'newDiscountPct', type: 'uint16' },
    { name: 'newBoostMult', type: 'uint16' },
    { name: 'newMinCash', type: 'uint256' },
    { name: 'newMinSpend', type: 'uint256' },
  ], outputs: [] },
] as const;

export default function ConfigTrendBtcDcaV1({ strategyAddr, chainId }: Props) {
  const { writeContractAsync } = useWriteContract();
  const client = React.useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http() }), [chainId]);
  const explorerBase = (appConfig as any)[getViemChain(chainId).name as any]?.explorer || (appConfig as any)[(getViemChain(chainId).id === 84532 ? 'base-sepolia' : 'base')]?.explorer;

  const { data: freqSec, refetch: refetchFreq } = useReadContract({ address: strategyAddr, abi: READ_ABI as any, functionName: 'frequency', query: { refetchInterval: 60000 } });
  const { data: smaLen } = useReadContract({ address: strategyAddr, abi: READ_ABI as any, functionName: 'smaLength', query: { refetchInterval: 60000 } });
  const { data: hyst } = useReadContract({ address: strategyAddr, abi: READ_ABI as any, functionName: 'hystBps', query: { refetchInterval: 60000 } });
  const { data: slope } = useReadContract({ address: strategyAddr, abi: READ_ABI as any, functionName: 'slopeLookbackDays', query: { refetchInterval: 60000 } });
  const { data: dcaBps } = useReadContract({ address: strategyAddr, abi: READ_ABI as any, functionName: 'dcaPctBps', query: { refetchInterval: 60000 } });
  const { data: discPct } = useReadContract({ address: strategyAddr, abi: READ_ABI as any, functionName: 'discountBelowSmaPct', query: { refetchInterval: 60000 } });
  const { data: boostMult } = useReadContract({ address: strategyAddr, abi: READ_ABI as any, functionName: 'dcaBoostMultiplier', query: { refetchInterval: 60000 } });
  const { data: minCash } = useReadContract({ address: strategyAddr, abi: READ_ABI as any, functionName: 'minCashStable', query: { refetchInterval: 60000 } });
  const { data: minSpend } = useReadContract({ address: strategyAddr, abi: READ_ABI as any, functionName: 'minSpendStable', query: { refetchInterval: 60000 } });

  const [days, setDays] = React.useState<string>('');
  const [sma, setSma] = React.useState<string>('');
  const [hystUi, setHystUi] = React.useState<string>('');
  const [slopeUi, setSlopeUi] = React.useState<string>('');
  const [dcaPctUi, setDcaPctUi] = React.useState<string>('');
  const [discUi, setDiscUi] = React.useState<string>('');
  const [boostUi, setBoostUi] = React.useState<string>('');
  const [minCashUi, setMinCashUi] = React.useState<string>('');
  const [minSpendUi, setMinSpendUi] = React.useState<string>('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ open: boolean; hash?: `0x${string}` }>({ open: false });

  React.useEffect(() => { if (freqSec !== undefined && (days === '' || Number(days) <= 0)) setDays(String(Math.max(1, Math.round(Number(freqSec as bigint) / 86400)))); }, [freqSec, days]);
  React.useEffect(() => { if (smaLen !== undefined && sma === '') setSma(String(Number(smaLen))); }, [smaLen, sma]);
  React.useEffect(() => { if (hyst !== undefined && hystUi === '') setHystUi(String(Number(hyst))); }, [hyst, hystUi]);
  React.useEffect(() => { if (slope !== undefined && slopeUi === '') setSlopeUi(String(Number(slope))); }, [slope, slopeUi]);
  React.useEffect(() => { if (dcaBps !== undefined && dcaPctUi === '') setDcaPctUi(String((Number(dcaBps) / 100).toFixed(2))); }, [dcaBps, dcaPctUi]);
  React.useEffect(() => { if (discPct !== undefined && discUi === '') setDiscUi(String(Number(discPct))); }, [discPct, discUi]);
  React.useEffect(() => { if (boostMult !== undefined && boostUi === '') setBoostUi(String(Number(boostMult))); }, [boostMult, boostUi]);
  React.useEffect(() => { if (minCash !== undefined && minCashUi === '') setMinCashUi(String(Number(minCash as bigint) / 1_000_000)); }, [minCash, minCashUi]);
  React.useEffect(() => { if (minSpend !== undefined && minSpendUi === '') setMinSpendUi(String(Number(minSpend as bigint) / 1_000_000)); }, [minSpend, minSpendUi]);

  const exec = async (fn: string, args: any[], after?: () => void) => {
    setBusy(fn);
    try {
      const hash = await writeWithFees({ write: writeContractAsync as any, client, address: strategyAddr, abi: WRITE_ABI as any, functionName: fn as any, args });
      await client.waitForTransactionReceipt({ hash });
      setToast({ open: true, hash });
      setTimeout(() => { try { after?.(); } catch {} }, 1000);
    } finally { setBusy(null); }
  };

  return (
    <>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Box sx={{ pt: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">Cadence</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ pb: 2 }}>
            How often the strategy re-evaluates the trend and DCA plan.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField size="small" sx={{ width: { xs: '100%', sm: 180 } }} type="number" value={days} onChange={(e) => setDays(e.target.value)} label="Cadence (days)" inputProps={{ min: 1, max: 60, step: 1 }} />
            <Button sx={{ p: 1 }} variant="outlined" onClick={() => exec('setFrequency', [BigInt(Math.floor(Number(days || '0')) * 86400)], () => refetchFreq?.())} disabled={busy === 'setFrequency'}>
              {busy === 'setFrequency' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight="bold">DCA Controls</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ pb: 2 }}>
            Base DCA %, discount trigger and multiplier, plus minimum cash/spend safeguards in USDC.
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0,1fr))' },
            columnGap: 1,
            rowGap: 1.25,
          }}>
            <TextField sx={{mt: 1}} size="small" type="number" value={dcaPctUi} onChange={(e) => setDcaPctUi(e.target.value)} label="Base DCA (%)" inputProps={{ min: 0, max: 100, step: 0.25 }} />
            <TextField sx={{mt: 1}} size="small" type="number" value={discUi} onChange={(e) => setDiscUi(e.target.value)} label="Discount Threshold (%)" inputProps={{ min: 0, max: 100, step: 1 }} />
            <TextField sx={{mt: 1}} size="small" type="number" value={boostUi} onChange={(e) => setBoostUi(e.target.value)} label="Boost Multiplier (×)" inputProps={{ min: 1, max: 10, step: 1 }} />
            <TextField sx={{mt: 1}} size="small" type="number" value={minCashUi} onChange={(e) => setMinCashUi(e.target.value)} label="Min Cash (USDC)" inputProps={{ min: 0, step: 1 }} />
            <TextField sx={{mt: 1}} size="small" type="number" value={minSpendUi} onChange={(e) => setMinSpendUi(e.target.value)} label="Min Spend (USDC)" inputProps={{ min: 0, step: 1 }} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
            <Button sx={{ px: 3, minWidth: '100%' }} variant="outlined" onClick={() => exec('setDcaParams', [
              Math.round(Math.max(0, Number(dcaPctUi || '0')) * 100),
              Math.round(Math.max(0, Number(discUi || '0'))),
              Math.round(Math.max(1, Number(boostUi || '1'))),
              BigInt(Math.floor(Math.max(0, Number(minCashUi || '0')) * 1_000_000)),
              BigInt(Math.floor(Math.max(0, Number(minSpendUi || '0')) * 1_000_000)),
            ])} disabled={busy === 'setDcaParams'}>
              {busy === 'setDcaParams' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Box>
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight="bold">Trend Filter</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ pb: 2 }}>
            SMA length, hysteresis band, and slope lookback detect and smooth the uptrend signal.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField size="small" sx={{ width: { xs: '100%', sm: 180 } }} type="number" value={sma} onChange={(e) => setSma(e.target.value)} label="SMA Length (days)" inputProps={{ min: 5, max: 200, step: 1 }} />
            <TextField size="small" sx={{ width: { xs: '100%', sm: 180 } }} type="number" value={hystUi} onChange={(e) => setHystUi(e.target.value)} label="Hysteresis (bps)" inputProps={{ min: 0, max: 5000, step: 10 }} />
            <TextField size="small" sx={{ width: { xs: '100%', sm: 180 } }} type="number" value={slopeUi} onChange={(e) => setSlopeUi(e.target.value)} label="Slope Lookback (days)" inputProps={{ min: 1, max: 60, step: 1 }} />
            <Button sx={{ p: 1 }} variant="outlined" onClick={() => exec('setSmaParams', [Number(sma || '0'), Number(hystUi || '0'), Number(slopeUi || '0')])} disabled={busy === 'setSmaParams'}>
              {busy === 'setSmaParams' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
        </Box>
      </Stack>
      <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast({ open: false, hash: undefined })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
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


