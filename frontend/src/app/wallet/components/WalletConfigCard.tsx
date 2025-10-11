'use client';

import React from 'react';
import { Card, CardContent, Typography, Stack, Box, Button } from '@mui/material';

type Props = {
  automationPaused?: boolean;
  slippage?: bigint | number;
  onToggleAutomation: () => void | Promise<void>;
  onOpenSlippage: () => void;
};

export default function WalletConfigCard({ automationPaused, slippage, onToggleAutomation, onOpenSlippage }: Props) {
  return (
    <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="subtitle1" fontWeight="bold">Wallet Config</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Automation</Typography>
            <Typography variant="body2">{automationPaused ? 'Paused' : 'Active'}</Typography>
          </Box>
          <Box>
            <Button
              size="small"
              variant="outlined"
              onClick={onToggleAutomation}
            >
              {automationPaused ? 'Activate Automation' : 'Pause Automation'}
            </Button>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Slippage</Typography>
            <Typography variant="body2">{slippage ? `${Number(slippage)} bps (${(Number(slippage)/100).toFixed(2)}%)` : '-'}</Typography>
          </Box>
          <Box>
            <Button size="small" variant="outlined" onClick={onOpenSlippage}>Update Slippage</Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}


