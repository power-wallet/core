'use client';

import React from 'react';
import { Box, Stack, TextField, Button, Typography, CircularProgress, Snackbar, Alert, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useWriteContract, useReadContract, useChainId } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { getViemChain } from '@/config/networks';
import appConfig from '@/config/appConfig.json';

type Props = {
  strategyAddr: `0x${string}`;
  chainId: number;
};

const SMART_DCA_READ_ABI = [
  { type: 'function', name: 'frequency', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'lowerBandBps', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'upperBandBps', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'buyBpsOfStable', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'smallBuyBpsOfStable', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'sellBpsOfRisk', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint16' } ] },
  { type: 'function', name: 'getModelAndBands', stateMutability: 'view', inputs: [], outputs: [ { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' } ] },
] as const;

const SMART_DCA_WRITE_ABI = [
  { type: 'function', name: 'setFrequency', stateMutability: 'nonpayable', inputs: [ { name: 'newFrequency', type: 'uint256' } ], outputs: [] },
  { type: 'function', name: 'setBands', stateMutability: 'nonpayable', inputs: [ { name: 'newLowerBps', type: 'uint16' }, { name: 'newUpperBps', type: 'uint16' } ], outputs: [] },
  { type: 'function', name: 'setTradePercents', stateMutability: 'nonpayable', inputs: [ { name: 'newBuyBpsStable', type: 'uint16' }, { name: 'newSmallBuyBpsStable', type: 'uint16' }, { name: 'newSellBpsRisk', type: 'uint16' } ], outputs: [] },
] as const;

export default function ConfigSmartBtcDcaV1({ strategyAddr, chainId }: Props) {
  const { data: freqSec } = useReadContract({ address: strategyAddr, abi: SMART_DCA_READ_ABI as any, functionName: 'frequency' });
  const { data: lowerBps } = useReadContract({ address: strategyAddr, abi: SMART_DCA_READ_ABI as any, functionName: 'lowerBandBps' });
  const { data: upperBps } = useReadContract({ address: strategyAddr, abi: SMART_DCA_READ_ABI as any, functionName: 'upperBandBps' });
  const { data: buyBps } = useReadContract({ address: strategyAddr, abi: SMART_DCA_READ_ABI as any, functionName: 'buyBpsOfStable' });
  const { data: smallBuyBps } = useReadContract({ address: strategyAddr, abi: SMART_DCA_READ_ABI as any, functionName: 'smallBuyBpsOfStable' });
  const { data: sellBps } = useReadContract({ address: strategyAddr, abi: SMART_DCA_READ_ABI as any, functionName: 'sellBpsOfRisk' });

  const [days, setDays] = React.useState<string>('');
  const [lower, setLower] = React.useState<number | ''>('');
  const [upper, setUpper] = React.useState<number | ''>('');
  const [buy, setBuy] = React.useState<number | ''>('');
  const [smallBuy, setSmallBuy] = React.useState<number | ''>('');
  const [sell, setSell] = React.useState<number | ''>('');
  const [busy, setBusy] = React.useState<null | 'freq' | 'bands' | 'percents'>(null);
  const { writeContractAsync } = useWriteContract();
  const client = React.useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http() }), [chainId]);
  const explorerBase = (appConfig as any)[getViemChain(chainId).name as any]?.explorer || (appConfig as any)[(getViemChain(chainId).id === 84532 ? 'base-sepolia' : 'base')]?.explorer;
  const [toast, setToast] = React.useState<{ open: boolean; hash?: `0x${string}` }>(() => ({ open: false }));

  const { data: modelAndBands } = useReadContract({
    address: strategyAddr,
    abi: SMART_DCA_READ_ABI as any,
    functionName: 'getModelAndBands',
  });

  const formatUsd0 = (n: number | undefined) => {
    if (n === undefined) return '-';
    return `$${Math.round(n).toLocaleString('en-US')}`;
  };

  React.useEffect(() => {
    if (freqSec !== undefined && (days === '' || Number(days) <= 0)) {
      const d = Math.max(1, Math.round(Number(freqSec as bigint) / 86400));
      setDays(String(d));
    }
  }, [freqSec]);
  React.useEffect(() => {
    if (lowerBps !== undefined && lower === '') setLower(Number(lowerBps));
  }, [lowerBps, lower]);
  React.useEffect(() => {
    if (upperBps !== undefined && upper === '') setUpper(Number(upperBps));
  }, [upperBps, upper]);
  React.useEffect(() => {
    if (buyBps !== undefined && buy === '') setBuy(Number(buyBps));
  }, [buyBps, buy]);
  React.useEffect(() => {
    if (smallBuyBps !== undefined && smallBuy === '') setSmallBuy(Number(smallBuyBps));
  }, [smallBuyBps, smallBuy]);
  React.useEffect(() => {
    if (sellBps !== undefined && sell === '') setSell(Number(sellBps));
  }, [sellBps, sell]);

  const updateFrequency = async () => {
    const d = Math.floor(Number(days || '0'));
    if (!Number.isInteger(d) || d < 1 || d > 60) return;
    setBusy('freq');
    try {
      let maxFeePerGas: bigint | undefined;
      let maxPriorityFeePerGas: bigint | undefined;
      try {
        const fees = await client.estimateFeesPerGas();
        maxFeePerGas = fees.maxFeePerGas;
        maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? BigInt(1_000_000_000);
      } catch {}
      const hash = await writeContractAsync({
        address: strategyAddr,
        abi: SMART_DCA_WRITE_ABI as any,
        functionName: 'setFrequency',
        args: [BigInt(d * 86400)],
        ...(maxFeePerGas ? { maxFeePerGas } : {}),
        ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
      });
      await client.waitForTransactionReceipt({ hash });
      setToast({ open: true, hash });
    } finally {
      setBusy(null);
    }
  };

  const updateBands = async () => {
    const lb = Number(lower || 0);
    const ub = Number(upper || 0);
    if (![lb, ub].every((v) => Number.isFinite(v) && v >= 0 && v <= 20000)) return;
    setBusy('bands');
    try {
      let maxFeePerGas: bigint | undefined;
      let maxPriorityFeePerGas: bigint | undefined;
      try {
        const fees = await client.estimateFeesPerGas();
        maxFeePerGas = fees.maxFeePerGas;
        maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? BigInt(1_000_000_000);
      } catch {}
      const hash = await writeContractAsync({
        address: strategyAddr,
        abi: SMART_DCA_WRITE_ABI as any,
        functionName: 'setBands',
        args: [lb, ub],
        ...(maxFeePerGas ? { maxFeePerGas } : {}),
        ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
      });
      await client.waitForTransactionReceipt({ hash });
      setToast({ open: true, hash });
    } finally {
      setBusy(null);
    }
  };

  const updatePercents = async () => {
    const b = Number(buy || 0);
    const sb = Number(smallBuy || 0);
    const s = Number(sell || 0);
    if (![b, sb, s].every((v) => Number.isFinite(v) && v >= 0 && v <= 10000)) return;
    setBusy('percents');
    try {
      let maxFeePerGas: bigint | undefined;
      let maxPriorityFeePerGas: bigint | undefined;
      try {
        const fees = await client.estimateFeesPerGas();
        maxFeePerGas = fees.maxFeePerGas;
        maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? BigInt(1_000_000_000);
      } catch {}
      const hash = await writeContractAsync({
        address: strategyAddr,
        abi: SMART_DCA_WRITE_ABI as any,
        functionName: 'setTradePercents',
        args: [b, sb, s],
        ...(maxFeePerGas ? { maxFeePerGas } : {}),
        ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
      });
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
          <Typography variant="caption">DCA Frequency (days)</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField size="small" type="number" value={days} onChange={(e) => setDays(e.target.value)} inputProps={{ min: 1, max: 60, step: 1 }} sx={{ maxWidth: 200 }} />
            <Button variant="outlined" size="small" onClick={updateFrequency} disabled={busy === 'freq'}>
              {busy === 'freq' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
        </Box>
        <Box>
          <Typography variant="caption">Bands (relative to model)</Typography>
          <Stack sx={{paddingTop: 1}} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField size="small" type="number" value={lower} onChange={(e) => setLower(Number(e.target.value))} label="Lower (bps)" inputProps={{ min: 0, max: 20000, step: 50 }} sx={{ maxWidth: 180 }} />
            <TextField size="small" type="number" value={upper} onChange={(e) => setUpper(Number(e.target.value))} label="Upper (bps)" inputProps={{ min: 0, max: 20000, step: 50 }} sx={{ maxWidth: 180 }} />
            <Button variant="outlined" size="small" onClick={updateBands} disabled={busy === 'bands'}>
              {busy === 'bands' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
          {(() => {
            try {
              const arr = modelAndBands as unknown as [bigint, bigint, bigint] | undefined;
              if (!arr) return null;
              const model = Number(arr[0]) / 1e8;
              const lowerTh = Number(arr[1]) / 1e8;
              const upperTh = Number(arr[2]) / 1e8;
              return (
                <Box sx={{ mt: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Power Law model: {formatUsd0(model)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Larger DCA-in below: {formatUsd0(lowerTh)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Smaller DCA-in between: {formatUsd0(lowerTh)} and {formatUsd0(model)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    DCA-out above: {formatUsd0(upperTh)}
                  </Typography>
                </Box>
              );
            } catch {
              return null;
            }
          })()}
        </Box>
        <Box>
          <Typography variant="caption">Trade Percents</Typography>
          <Stack sx={{paddingTop: 1}} direction={{ xs: 'column', sm: 'column' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'left' }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="buy-bps-label">Buy % (below lower band)</InputLabel>
              <Select labelId="buy-bps-label" label="Buy % (below lower band)" value={buy === '' ? '' : Number(buy)} onChange={(e) => setBuy(Number(e.target.value))}>
                {[100, 200, 500, 1000, 2000, 5000].map((v) => (<MenuItem key={v} value={v}>{(v/100).toFixed(2)}%</MenuItem>))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel id="small-buy-bps-label">Small Buy % (between lower and model)</InputLabel>
              <Select labelId="small-buy-bps-label" label="Small Buy % (between lower and model)" value={smallBuy === '' ? '' : Number(smallBuy)} onChange={(e) => setSmallBuy(Number(e.target.value))}>
                {[50, 100, 150, 200, 500].map((v) => (<MenuItem key={v} value={v}>{(v/100).toFixed(2)}%</MenuItem>))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="sell-bps-label">Sell % (above upper band)</InputLabel>
              <Select labelId="sell-bps-label" label="Sell % (above upper band)" value={sell === '' ? '' : Number(sell)} onChange={(e) => setSell(Number(e.target.value))}>
                {[100, 200, 500, 1000, 2000, 5000].map((v) => (<MenuItem key={v} value={v}>{(v/100).toFixed(2)}%</MenuItem>))}
              </Select>
            </FormControl>
            <Button variant="outlined" size="small" onClick={updatePercents} disabled={busy === 'percents'}>
              {busy === 'percents' ? (<><CircularProgress size={14} sx={{ mr: 1 }} /> Updating…</>) : 'Update'}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Defaults: Buy 5%, Small Buy 1%, Sell 5%
          </Typography>
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


