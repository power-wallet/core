'use client';

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Typography, Button, CircularProgress, Box, Link } from '@mui/material';
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
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Your balance: {formatTokenAmountBigint(userUsdcBalance, 6)} USDC
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Link
            component="button"
            type="button"
            onClick={() => {
              const v = formatTokenAmountBigint(userUsdcBalance, 6);
              if (v && v !== '0') onChangeAmount(v);
            }}
            underline="hover"
            sx={{ fontSize: '0.75rem' }}
          >
            max
          </Link>
        </Box>
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


