'use client';

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Button, CircularProgress } from '@mui/material';
import { formatAllowance, formatTokenAmountBigint } from '@/lib/format';

type Props = {
  open: boolean;
  onClose: () => void;
  amount: string;
  onChangeAmount: (v: string) => void;
  userUsdcBalance?: bigint;
  allowance?: bigint;
  onSubmit: () => Promise<void> | void;
  isSubmitting?: boolean;
};

export default function DepositDialog({ open, onClose, amount, onChangeAmount, userUsdcBalance, allowance, onSubmit, isSubmitting }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Deposit USDC</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Amount (USDC)"
          type="number"
          fullWidth
          value={amount}
          onChange={(e) => onChangeAmount(e.target.value)}
          inputProps={{ min: 0, step: '0.01' }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Your balance: {formatTokenAmountBigint(userUsdcBalance, 6)} USDC
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Allowance: {formatAllowance(allowance)} USDC
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (<><CircularProgress size={16} sx={{ mr: 1 }} /> Depositing…</>) : 'Deposit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


