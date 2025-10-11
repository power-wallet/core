'use client';

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, TextField, Typography, Button, CircularProgress } from '@mui/material';
import { formatTokenAmountBigint } from '@/lib/format';

type Props = {
  open: boolean;
  onClose: () => void;
  withdrawAssetAddr: `0x${string}` | '';
  onChangeAsset: (addr: `0x${string}` | '') => void;
  withdrawAmount: string;
  onChangeAmount: (v: string) => void;
  stableTokenAddr?: `0x${string}`;
  riskAssets: string[];
  stableBal?: bigint;
  riskBals: bigint[];
  addressToMeta: (addr: string | undefined) => { symbol: string; decimals: number } | undefined;
  onSubmit: () => Promise<void> | void;
  isSubmitting?: boolean;
};

export default function WithdrawDialog({ open, onClose, withdrawAssetAddr, onChangeAsset, withdrawAmount, onChangeAmount, stableTokenAddr, riskAssets, stableBal, riskBals, addressToMeta, onSubmit, isSubmitting }: Props) {
  const meta = addressToMeta(withdrawAssetAddr || '');
  const sym = meta?.symbol || 'token';
  const available = (() => {
    const addr = withdrawAssetAddr?.toLowerCase();
    const isStable = addr && stableTokenAddr && addr === String(stableTokenAddr).toLowerCase();
    let bal: bigint | undefined = undefined;
    if (isStable) {
      bal = stableBal;
    } else if (addr) {
      const idx = riskAssets.findIndex(x => x.toLowerCase() === addr);
      bal = idx === -1 ? undefined : riskBals[idx];
    }
    return bal !== undefined && meta?.decimals !== undefined ? `${formatTokenAmountBigint(bal, meta.decimals)} ${sym}` : '';
  })();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Withdraw Asset</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel id="withdraw-asset-label">Asset</InputLabel>
          <Select
            labelId="withdraw-asset-label"
            label="Asset"
            value={withdrawAssetAddr || ''}
            onChange={(e) => onChangeAsset(e.target.value as `0x${string}`)}
          >
            {stableTokenAddr ? (
              <MenuItem value={stableTokenAddr as `0x${string}`}>USDC</MenuItem>
            ) : null}
            {riskAssets.map((ra) => {
              const key = String(ra);
              const m = addressToMeta(key);
              const symbol = m?.symbol || `${key.slice(0, 6)}…${key.slice(-4)}`;
              return <MenuItem key={key} value={key as `0x${string}`}>{symbol}</MenuItem>;
            })}
          </Select>
        </FormControl>
        <TextField
          autoFocus
          margin="dense"
          label={`Amount (${sym})`}
          type="number"
          fullWidth
          value={withdrawAmount}
          onChange={(e) => onChangeAmount(e.target.value)}
          inputProps={{ min: 0, step: '0.000001' }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {available ? `Available: ${available}` : ''}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (<><CircularProgress size={16} sx={{ mr: 1 }} /> Withdrawing…</>) : 'Withdraw'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


