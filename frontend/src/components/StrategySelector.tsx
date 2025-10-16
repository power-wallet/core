'use client';

import React from 'react';
import { Stack, Typography, ToggleButtonGroup, ToggleButton, TextField, Box } from '@mui/material';

type Props = {
  selectedStrategyId: string;
  onChangeStrategy: (id: string) => void;
  description?: string;
  simpleAmount?: string;
  onChangeSimpleAmount?: (v: string) => void;
  simpleFrequency?: string;
  onChangeSimpleFrequency?: (v: string) => void;
  smartDays?: string;
  onChangeSmartDays?: (v: string) => void;
};

export default function StrategySelector({
  selectedStrategyId,
  onChangeStrategy,
  description,
  simpleAmount,
  onChangeSimpleAmount,
  simpleFrequency,
  onChangeSimpleFrequency,
  smartDays,
  onChangeSmartDays,
}: Props) {
  return (
    <Stack spacing={2}>
      <Typography sx={{ pt: 2 }} variant="subtitle1" fontWeight="bold">Select Strategy</Typography>
      <Typography sx={{ pt: 0 }} variant="caption" color="text.secondary">
        Select the Bitcoin accumulation strategy you want to use with your wallet
      </Typography>
      <ToggleButtonGroup exclusive size="small" value={selectedStrategyId} onChange={(_, v) => v && onChangeStrategy(v)}>
        <ToggleButton value="simple-btc-dca-v1">Simple DCA</ToggleButton>
        <ToggleButton value="power-btc-dca-v2">Power DCA</ToggleButton>
        <ToggleButton value="smart-btc-dca-v2">Smart DCA</ToggleButton>
        <ToggleButton value="trend-btc-dca-v1">Trend DCA</ToggleButton>
      </ToggleButtonGroup>
      {description ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pb: 1 }}>
          {description}
        </Typography>
      ) : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="right">
        {selectedStrategyId !== 'power-btc-dca-v2' && (
          <TextField label="DCA amount (USDC)" type="number" value={simpleAmount || ''} onChange={(e) => onChangeSimpleAmount?.(e.target.value)} inputProps={{ min: 1 }} />
        )}
        <Box>
          <Typography variant="caption" display="block" sx={{ mb: 1 }}>Cadence</Typography>
          <ToggleButtonGroup value={simpleFrequency} exclusive onChange={(_, val) => val && onChangeSimpleFrequency?.(val)} size="small">
            <ToggleButton value={String(60 * 60 * 24)}>1d</ToggleButton>
            <ToggleButton value={String(60 * 60 * 24 * 2)}>2d</ToggleButton>
            <ToggleButton value={String(60 * 60 * 24 * 3)}>3d</ToggleButton>
            <ToggleButton value={String(60 * 60 * 24 * 5)}>5d</ToggleButton>
            <ToggleButton value={String(60 * 60 * 24 * 7)}>7d</ToggleButton>
            <ToggleButton value={String(60 * 60 * 24 * 10)}>10d</ToggleButton>
            <ToggleButton value={String(60 * 60 * 24 * 14)}>14w</ToggleButton>
            <ToggleButton value={String(60 * 60 * 24 * 30)}>1m</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Stack>
    </Stack>
  );
}


