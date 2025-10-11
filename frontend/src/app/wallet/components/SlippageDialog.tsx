'use client';

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';

type Props = {
  open: boolean;
  onClose: () => void;
  slippage: number;
  onChange: (v: string) => void;
  onSubmit: () => Promise<void> | void;
};

export default function SlippageDialog({ open, onClose, slippage, onChange, onSubmit }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Update Slippage</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label={`Slippage (bps) — ${(Number(slippage)/100).toFixed(2)}%`}
          type="number"
          fullWidth
          onChange={(e) => onChange(e.target.value)}
          inputProps={{ min: 0, max: 4999, step: 1, placeholder: String(Number(slippage ?? 0)) }}
          helperText="Max 5000 bps (50%)"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit}>Update Slippage</Button>
      </DialogActions>
    </Dialog>
  );
}


