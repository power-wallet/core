'use client';

import React from 'react';
import { Card, CardContent, Typography, Box, Stack, IconButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LaunchIcon from '@mui/icons-material/Launch';
import { formatUsd6Bigint } from '@/lib/format';

type Props = {
  strategyName?: string;
  description?: string;
  strategyAddr?: `0x${string}` | string | null;
  explorerBase?: string;
  dcaAmount?: bigint;
  frequency?: bigint;
  strategyIdStr?: string;
  onOpenConfig: () => void;
};

export default function StrategyCard({ strategyName, description, strategyAddr, explorerBase, dcaAmount, frequency, strategyIdStr, onOpenConfig }: Props) {
  return (
    <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1 }}>Strategy</Typography>
          <IconButton size="small" aria-label="Configure strategy" onClick={onOpenConfig}>
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {(() => {
            const finalDesc = description ? String(description) : '';
            return strategyName ? `${String(strategyName)} - ${finalDesc}` : finalDesc;
          })()}
        </Typography>
        {strategyAddr ? (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 1 }}>
            <span>{`${String(strategyAddr).slice(0, 6)}…${String(strategyAddr).slice(-4)}`}</span>
            {explorerBase ? (
              <a
                href={`${explorerBase}/address/${strategyAddr}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', marginLeft: 6, display: 'inline-flex', alignItems: 'center' }}
                aria-label="Open strategy on block explorer"
              >
                <LaunchIcon sx={{ fontSize: 14 }} />
              </a>
            ) : null}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={3} sx={{ mt: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption">DCA Amount</Typography>
            <Typography variant="body1">
              {(() => {
                const id = String(strategyIdStr || '').trim();
                if (id === 'btc-dca-power-law-v1') return 'Dynamic %';
                return formatUsd6Bigint(dcaAmount);
              })()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption">Frequency</Typography>
            <Typography variant="body1">{frequency ? `${Number(frequency) / 86400} d` : '-'}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}


