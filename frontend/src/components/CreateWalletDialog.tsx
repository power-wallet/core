'use client';

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StrategySelector from './StrategySelector';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  creating?: boolean;
  isConfirming?: boolean;
  selectedStrategyId: string;
  onChangeStrategy: (id: string) => void;
  description?: string;
  amount: string;
  onChangeAmount: (v: string) => void;
  frequency: string;
  onChangeFrequency: (v: string) => void;
  smartDays: string;
  onChangeSmartDays: (v: string) => void;
};

export default function CreateWalletDialog({ open, onClose, onCreate, creating, isConfirming, selectedStrategyId, onChangeStrategy, description, amount, onChangeAmount, frequency, onChangeFrequency, smartDays, onChangeSmartDays }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isMobile} PaperProps={{ sx: { borderRadius: { xs: 0, sm: 1 } } }}>
      <DialogTitle sx={{
        px: { xs: 2, sm: 3 },
        py: { xs: 1.5, sm: 2 },
        position: 'sticky',
        top: 0,
        zIndex: 1,
        bgcolor: { xs: 'background.default', sm: 'background.paper' },
        borderBottom: '1px solid',
        borderColor: 'divider',
        boxShadow: { xs: '0 2px 8px rgba(0,0,0,0.35)', sm: '0 1px 2px rgba(0,0,0,0.18)' },
        borderTopLeftRadius: { sm: 8 },
        borderTopRightRadius: { sm: 8 },
      }}>
        Create a New Power Wallet
        {isMobile ? (
          <IconButton aria-label="close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1, sm: 2 }, pb: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <StrategySelector
            selectedStrategyId={selectedStrategyId}
            onChangeStrategy={onChangeStrategy}
            description={description}
            simpleAmount={amount}
            onChangeSimpleAmount={onChangeAmount}
            simpleFrequency={frequency}
            onChangeSimpleFrequency={onChangeFrequency}
            smartDays={smartDays}
            onChangeSmartDays={onChangeSmartDays}
          />
          
          <Typography variant="caption">
            You will be able to configure your strategy after creating the wallet.
          </Typography>

          {isMobile ? (
            <Button variant="contained" disabled={creating || isConfirming} onClick={onCreate} sx={{ alignSelf: 'center', mt: 2 }}>
              {creating || isConfirming ? 'Creating…' : 'Create Power Wallet'}
            </Button>
          ) : null}
        </Stack>
      </DialogContent>
      {isMobile ? null : (
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" disabled={creating || isConfirming} onClick={onCreate}>{creating || isConfirming ? 'Creating…' : 'Create Power Wallet'}</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}


