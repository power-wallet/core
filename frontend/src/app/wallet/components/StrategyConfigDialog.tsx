'use client';

import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button, Typography, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ConfigSimpleDcaV1 from '../strategies/ConfigSimpleDcaV1';
import ConfigPowerBtcDcaV2 from '../strategies/ConfigSmartBtcDcaV1';
import ConfigSmartBtcDcaV2 from '../strategies/ConfigPowerBtcDcaV1';

type Props = {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
  chainId: number;
  content: 'simple' | 'smart' | 'power' | 'unknown';
  strategyAddr?: `0x${string}`;
  dcaAmount?: bigint;
  freq?: bigint;
  stableSymbol?: string;
  stableDecimals?: number;
};

export default function StrategyConfigDialog({ open, onClose, isMobile, chainId, content, strategyAddr, dcaAmount, freq, stableSymbol, stableDecimals }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ sx: { borderRadius: { xs: 0, sm: 1 } } }}
    >
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
        Configure Strategy
        {isMobile ? (
          <IconButton aria-label="close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1, sm: 2 }, pb: { xs: 2, sm: 3 } }}>
        {content === 'simple' && strategyAddr ? (
          <ConfigSimpleDcaV1 strategyAddr={strategyAddr} chainId={chainId} stableSymbol={stableSymbol || 'USDC'} stableDecimals={stableDecimals ?? 6} initialAmountStable={dcaAmount || (0n as any)} initialFrequency={freq || (0n as any)} />
        ) : content === 'power' && strategyAddr ? (
          <ConfigPowerBtcDcaV2 strategyAddr={strategyAddr} chainId={chainId} />
        ) : content === 'smart' && strategyAddr ? (
          <ConfigSmartBtcDcaV2 strategyAddr={strategyAddr} chainId={chainId} stableSymbol={stableSymbol || 'USDC'} stableDecimals={stableDecimals ?? 6} />
        ) : (
          <Typography variant="body2" color="text.secondary">This strategy is not yet configurable in the app.</Typography>
        )}
      </DialogContent>
      {!isMobile ? (
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      ) : null}
    </Dialog>
  );
}


