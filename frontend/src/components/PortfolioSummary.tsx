'use client';

import React from 'react';
import { Card, CardContent, Typography, Box, Stack } from '@mui/material';

type PerAsset = Record<string, { amount: number; usd: number }>;

type Props = {
  totalUsd: number;
  perAsset: PerAsset;
};

export default function PortfolioSummary({ totalUsd, perAsset }: Props) {
  if (!totalUsd || totalUsd <= 0) return null;
  const entries = Object.entries(perAsset).filter(([, v]) => v.usd > 0).sort((a, b) => b[1].usd - a[1].usd);
  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'stretch' }}>
          <Box sx={{ flex: 1, minHeight: { xs: 60, sm: 120 }, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', display: 'flex' }}>
            {entries.map(([sym, v]) => {
              const pct = totalUsd > 0 ? (v.usd / totalUsd) : 0;
              const bg = sym === 'cbBTC' ? '#F59E0B' : (sym === 'WETH' ? '#9CA3AF' : '#10B981');
              return (
                <Box key={sym} sx={{ flex: pct, bgcolor: bg, minWidth: pct > 0 ? 2 : 0 }} title={`${sym}: $${v.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              );
            })}
          </Box>
          <Box sx={{ flex: { xs: '1 1 auto', sm: '0 0 340px' }, display: 'flex', alignItems: 'stretch', mt: { xs: 0, sm: 0 } }}>
            <Stack spacing={0.75} sx={{ my: 0, alignSelf: 'stretch', justifyContent: 'flex-start' }}>
              <Typography variant="h5" sx={{ mb: 2 }}>
                {`Total Value: $${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Typography>
              {entries.map(([sym, v]) => (
                <Typography key={sym} variant="body2">
                  {v.amount.toLocaleString('en-US', { maximumFractionDigits: sym === 'USDC' ? 2 : 8 })} {sym} — ${v.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              ))}
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}


