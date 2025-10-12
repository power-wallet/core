'use client';

import React from 'react';
import { Box, Stack, TextField, Button, Typography, CircularProgress, Snackbar, Alert, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useWriteContract, useReadContract } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { writeWithFees } from '@/lib/tx';
import { getViemChain } from '@/config/networks';

const ABI_READ = [
  { type: 'function', name: 'frequency', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'baseDcaStable', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'targetBtcBps', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'bandDeltaBps', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'bufferMultX', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'cmaxMultX', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'rebalanceCapBps', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'kKicker1e6', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint32' } ] },
  { type: 'function', name: 'thresholdMode', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'bool' } ] },
] as const;

const ABI_WRITE = [
  { type: 'function', name: 'setFrequency', stateMutability: 'nonpayable', inputs: [ { name: 'newFrequency', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'setBaseDcaStable', stateMutability: 'nonpayable', inputs: [ { name: 'newBase', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'setBuffer', stateMutability: 'nonpayable', inputs: [ { name: 'newBufferMultX', type: 'uint16' } ], outputs: [] },
  { type: 'function', name: 'setKickerParams', stateMutability: 'nonpayable', inputs: [ { name: 'newKKicker1e6', type: 'uint32' }, { name: 'newCmaxMultX', type: 'uint16' } ], outputs: [] },
  { type: 'function', name: 'setRebalanceParams', stateMutability: 'nonpayable', inputs: [ { name: 'newTargetBps', type: 'uint16' }, { name: 'newBandDeltaBps', type: 'uint16' }, { name: 'newRebalanceCapBps', type: 'uint16' } ], outputs: [] },
  { type: 'function', name: 'setThresholdMode', stateMutability: 'nonpayable', inputs: [ { name: 'enabled', type: 'bool' } ], outputs: [] },
] as const;

type Props = { strategyAddr: `0x${string}`; chainId: number; stableSymbol?: string; stableDecimals?: number };

export default function ConfigPowerBtcDcaV1({ strategyAddr, chainId, stableSymbol = 'USDC', stableDecimals = 6 }: Props) {
  const { writeContractAsync } = useWriteContract();
  const client = React.useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http() }), [chainId]);

  const { data: freqSec, refetch: refetchFreq } = useReadContract({ address: strategyAddr, abi: ABI_READ as any, functionName: 'frequency', query: { refetchInterval: 60000 } });
  const { data: baseDca, refetch: refetchBase } = useReadContract({ address: strategyAddr, abi: ABI_READ as any, functionName: 'baseDcaStable', query: { refetchInterval: 60000 } });
  const { data: targetBps, refetch: refetchTarget } = useReadContract({ address: strategyAddr, abi: ABI_READ as any, functionName: 'targetBtcBps', query: { refetchInterval: 60000 } });
  const { data: bandDelta, refetch: refetchBand } = useReadContract({ address: strategyAddr, abi: ABI_READ as any, functionName: 'bandDeltaBps', query: { refetchInterval: 60000 } });
  const { data: bufferX, refetch: refetchBuffer } = useReadContract({ address: strategyAddr, abi: ABI_READ as any, functionName: 'bufferMultX', query: { refetchInterval: 60000 } });
  const { data: cmaxX, refetch: refetchCmax } = useReadContract({ address: strategyAddr, abi: ABI_READ as any, functionName: 'cmaxMultX', query: { refetchInterval: 60000 } });
  const { data: capBps, refetch: refetchCap } = useReadContract({ address: strategyAddr, abi: ABI_READ as any, functionName: 'rebalanceCapBps', query: { refetchInterval: 60000 } });
  const { data: k1e6, refetch: refetchK } = useReadContract({ address: strategyAddr, abi: ABI_READ as any, functionName: 'kKicker1e6', query: { refetchInterval: 60000 } });
  const { data: threshold, refetch: refetchThreshold } = useReadContract({ address: strategyAddr, abi: ABI_READ as any, functionName: 'thresholdMode', query: { refetchInterval: 60000 } });

  const [days, setDays] = React.useState<string>('');
  const [base, setBase] = React.useState<string>('');
  const [targetPct, setTargetPct] = React.useState<string>('');
  const [bandPct, setBandPct] = React.useState<string>('');
  const [buffer, setBuffer] = React.useState<string>('');
  const [cmax, setCmax] = React.useState<string>('');
  const [capPct, setCapPct] = React.useState<string>('');
  const [kUi, setKUi] = React.useState<string>(''); // human-readable, e.g. "0.10"
  const [th, setTh] = React.useState<boolean | ''>('');
  const [busy, setBusy] = React.useState<null | string>(null);
  const [toast, setToast] = React.useState<{ open: boolean; hash?: `0x${string}` }>({ open: false });

  React.useEffect(() => { if (freqSec !== undefined && (days === '' || Number(days) <= 0)) setDays(String(Math.max(1, Math.round(Number(freqSec as bigint) / 86400)))); }, [freqSec, days]);
  React.useEffect(() => { if (baseDca !== undefined && base === '') setBase(String(Number(baseDca as bigint) / 10 ** stableDecimals)); }, [baseDca, base, stableDecimals]);
  React.useEffect(() => { if (targetBps !== undefined && targetPct === '') setTargetPct(String((Number(targetBps) / 100).toFixed(2))); }, [targetBps, targetPct]);
  React.useEffect(() => { if (bandDelta !== undefined && bandPct === '') setBandPct(String((Number(bandDelta) / 100).toFixed(2))); }, [bandDelta, bandPct]);
  React.useEffect(() => { if (bufferX !== undefined && buffer === '') setBuffer(String(Number(bufferX))); }, [bufferX, buffer]);
  React.useEffect(() => { if (cmaxX !== undefined && cmax === '') setCmax(String(Number(cmaxX))); }, [cmaxX, cmax]);
  React.useEffect(() => { if (capBps !== undefined && capPct === '') setCapPct(String((Number(capBps) / 100).toFixed(2))); }, [capBps, capPct]);
  React.useEffect(() => { if (k1e6 !== undefined && kUi === '') setKUi((Number(k1e6) / 1_000_000).toFixed(2)); }, [k1e6, kUi]);
  React.useEffect(() => { if (threshold !== undefined && th === '') setTh(Boolean(threshold)); }, [threshold, th]);

  const exec = async (fn: string, args: any[], after?: () => void) => {
    setBusy(fn);
    try {
      const hash = await writeWithFees({ write: writeContractAsync as any, client, address: strategyAddr, abi: ABI_WRITE as any, functionName: fn as any, args });
      await client.waitForTransactionReceipt({ hash });
      setToast({ open: true, hash });
      setTimeout(() => { try { after?.(); } catch {} }, 1000);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Box sx={{ pt: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">Common settings</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ pb: 2 }}>
            Configure your base buy size and cadence. The buffer keeps a USDC reserve equal to buffer × base DCA before spending extra.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField fullWidth label="DCA Frequency (days)" sx={{ width: { xs: '100%', sm: 150 } }} size="small" type="number" value={days} onChange={(e) => setDays(e.target.value)} inputProps={{ min: 1, max: 60, step: 1 }} />
            <Button sx={{ p: 1 }} variant="outlined" size="small" onClick={() => exec('setFrequency', [BigInt(Math.floor(Number(days || '0')) * 86400)], () => refetchFreq?.())} disabled={busy === 'setFrequency'}>
              {busy === 'setFrequency' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
        </Box>
        <Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField fullWidth sx={{ width: { xs: '100%', sm: 150 } }} size="small" label="Base DCA Amount" type="number" value={base} onChange={(e) => setBase(e.target.value)} inputProps={{ min: 1, step: 1 }} />
            <Button sx={{ p: 1 }} variant="outlined" size="small" onClick={() => exec('setBaseDcaStable', [BigInt(Math.floor(Number(base || '0') * 10 ** stableDecimals))], () => refetchBase?.())} disabled={busy === 'setBaseDcaStable'}>
              {busy === 'setBaseDcaStable' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
        </Box>
        {/* Removed old target/band block; handled under Rebalancing below */}
        <Box sx={{ pt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField fullWidth sx={{ width: { xs: '100%', sm: 150 } }} size="small" type="number" value={buffer} onChange={(e) => setBuffer(e.target.value)} label="Buffer Multiplier (×)" inputProps={{ min: 0, max: 60, step: 1 }} />
            <Button sx={{ p: 1 }} variant="outlined" size="small" onClick={() => exec('setBuffer', [Number(buffer || '0')], () => { refetchBuffer?.(); })} disabled={busy === 'setBuffer'}>
              {busy === 'setBuffer' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
        </Box>
        <Box sx={{ pt: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Kicker params</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ pb: 2 }}>
            Increase buy size when volatility and drawdown are high. Cap limits the extra buy to a multiple of base DCA.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }} fullWidth>
            <InputLabel id="kicker-label">Kicker Coefficient</InputLabel>
            <Select labelId="kicker-label" label="Kicker Coefficient" value={kUi} onChange={(e) => setKUi(String(e.target.value))}>
                {/* ensure current on-chain value is selectable even if not in defaults */}
                {kUi && !['0.02','0.03','0.05','0.07','0.10'].includes(kUi) ? (
                <MenuItem key={`current-${kUi}`} value={kUi}>{kUi} (current)</MenuItem>
                ) : null}
                {['0.02','0.03','0.05','0.07','0.10'].map(v => (
                <MenuItem key={v} value={v}>{v}</MenuItem>
                ))}
            </Select>
            </FormControl>
            <TextField fullWidth sx={{ width: { xs: '100%', sm: 150 } }} size="small" type="number" value={cmax} onChange={(e) => setCmax(e.target.value)} label="Kicker Cap (×)" inputProps={{ min: 1, max: 20, step: 1 }} />
            <Button sx={{ p: 1 }} variant="outlined" size="small" onClick={() => exec('setKickerParams', [Math.round(Number(kUi || '0') * 1_000_000), Number(cmax || '0')], () => { refetchK?.(); refetchCmax?.(); })} disabled={busy === 'setKickerParams'}>
              {busy === 'setKickerParams' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
        </Box>
        <Box sx={{ py: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Rebalancing</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ pb: 2 }}>
            Threshold mode buys or sells to push BTC weight back into your bands. When disabled, only DCA + kicker logic applies.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row', py: 1 }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <FormControl size="small" sx={{ width: { xs: '100%', sm: 200 } }} fullWidth>
                <InputLabel id="threshold-label">Threshold Rebalancing</InputLabel>
                <Select labelId="threshold-label" label="Threshold Rebalancing" value={th === '' ? '' : (th ? 'enabled' : 'disabled')} onChange={(e) => setTh(String(e.target.value) === 'enabled')}>
                  <MenuItem value={'enabled'}>Enabled</MenuItem>
                  <MenuItem value={'disabled'}>Disabled</MenuItem>
                </Select>
              </FormControl>
            <Button sx={{ p: 1 }} variant="outlined" size="small" onClick={() => exec('setThresholdMode', [Boolean(th)], () => refetchThreshold?.())} disabled={busy === 'setThresholdMode'}>
              {busy === 'setThresholdMode' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
          {Boolean(th) ? (
            <Box sx={{ py: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ pb: 2 }}>
                Set your target BTC weight and band width (in %). The rebalance cap limits any single rebalance to a % of NAV.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField fullWidth sx={{ width: { xs: '100%', sm: 180 } }} size="small" type="number" value={targetPct} onChange={(e) => setTargetPct(e.target.value)} label="Target BTC Weight (%)" inputProps={{ min: 0, max: 100, step: 0.25 }} />
                <TextField fullWidth sx={{ width: { xs: '100%', sm: 180 } }} size="small" type="number" value={bandPct} onChange={(e) => setBandPct(e.target.value)} label="Band Δ (%)" inputProps={{ min: 0, max: 100, step: 0.25 }} />
                <TextField fullWidth sx={{ width: { xs: '100%', sm: 180 } }} size="small" type="number" value={capPct} onChange={(e) => setCapPct(e.target.value)} label="Rebalance Cap (%)" inputProps={{ min: 0, max: 100, step: 0.25 }} />
                <Button sx={{ p: 1 }} variant="outlined" size="small" onClick={() => exec('setRebalanceParams', [
                    Math.round(Math.max(0, Number(targetPct || '0')) * 100),
                    Math.round(Math.max(0, Number(bandPct || '0')) * 100),
                    Math.round(Math.max(0, Number(capPct || '0')) * 100),
                    ], () => { refetchTarget?.(); refetchBand?.(); refetchCap?.(); })} disabled={busy === 'setRebalanceParams'}>
                    {busy === 'setRebalanceParams' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
                </Button>
              </Stack>
            </Box>
          ) : null}
        </Box>
      </Stack>
      <Snackbar open={toast.open} autoHideDuration={6000} onClose={() => setToast({ open: false, hash: undefined })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setToast({ open: false, hash: undefined })} severity="success" sx={{ width: '100%' }}>
          Transaction confirmed.
        </Alert>
      </Snackbar>
    </>
  );
}
