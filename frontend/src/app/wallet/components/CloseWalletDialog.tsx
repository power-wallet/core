'use client';

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Alert, Button, Box } from '@mui/material';

type Props = {
  open: boolean;
  onClose: () => void;
  hasAnyFunds: boolean;
  onConfirm: () => Promise<void> | void;
};

export default function CloseWalletDialog({ open, onClose, hasAnyFunds, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Close Wallet</DialogTitle>
      <Box sx={{ mt: 0, mb: 1, borderBottom: '1px solid', borderColor: 'divider' }} />
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          This will pause automation and permanently delete this wallet.
        </Typography>
        {hasAnyFunds ? (
          <Alert severity="warning">Your wallet has funds. Withdraw all your funds before closing your wallet.</Alert>
        ) : (
          <Typography variant="caption" color="text.secondary">
            No funds detected. You can close the wallet safely. <br />
            This will require 2 transactions to complete, one to pause automation and one to unregister your wallet.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" disabled={hasAnyFunds} onClick={onConfirm}>Confirm</Button>
      </DialogActions>
    </Dialog>
  );
}


