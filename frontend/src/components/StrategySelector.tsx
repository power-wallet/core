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
      <ToggleButtonGroup exclusive size="small" value={selectedStrategyId} onChange={(_, v) => v && onChangeStrategy(v)}>
        <ToggleButton value="simple-btc-dca-v1">Simple BTC DCA</ToggleButton>
        <ToggleButton value="btc-dca-power-law-v1">Smart BTC DCA</ToggleButton>
      </ToggleButtonGroup>
      {description ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{description}</Typography>
      ) : null}
      {selectedStrategyId === 'simple-btc-dca-v1' ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="right">
          <TextField label="DCA amount (USDC)" type="number" value={simpleAmount || ''} onChange={(e) => onChangeSimpleAmount?.(e.target.value)} inputProps={{ min: 1 }} />
          <Box>
            <Typography variant="caption" display="block" sx={{ mb: 1 }}>Frequency</Typography>
            <ToggleButtonGroup value={simpleFrequency} exclusive onChange={(_, val) => val && onChangeSimpleFrequency?.(val)} size="small">
              <ToggleButton value={String(60 * 60 * 24)}>1d</ToggleButton>
              <ToggleButton value={String(60 * 60 * 24 * 3)}>3d</ToggleButton>
              <ToggleButton value={String(60 * 60 * 24 * 5)}>5d</ToggleButton>
              <ToggleButton value={String(60 * 60 * 24 * 7)}>1w</ToggleButton>
              <ToggleButton value={String(60 * 60 * 24 * 14)}>2w</ToggleButton>
              <ToggleButton value={String(60 * 60 * 24 * 30)}>1m</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="start">
              <Typography variant="caption">DCA Frequency</Typography>
              <TextField label="days" size="small" type="number" value={smartDays || ''} onChange={(e) => onChangeSmartDays?.(e.target.value)} inputProps={{ min: 1, max: 60, step: 1 }} sx={{ width: 100 }} />
            </Stack>
          </Box>
        </Stack>
      )}
    </Stack>
  );
}


