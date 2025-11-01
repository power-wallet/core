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
          {/* Left: Assets list stacked vertically */}
          <Box sx={{ flex: { xs: '1 1 auto', sm: '0 0 420px' }, display: 'flex', alignItems: 'stretch' }}>
            <Stack spacing={1.25} sx={{ my: 0, alignSelf: 'stretch', justifyContent: 'flex-start', width: '100%' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 1.25 }}>
                {(['USDC', 'cbBTC', 'WETH'] as const).map((sym) => {
                  const v = (perAsset as any)?.[sym] as { amount: number; usd: number } | undefined;
                  if (!v || (v.usd ?? 0) <= 0) return null;
                  const icon = sym === 'USDC' ? '/img/wallet/usdc.svg' : (sym === 'cbBTC' ? '/img/wallet/btc.svg' : undefined);
                  return (
                    <Box key={sym} sx={{ display: 'grid', gridTemplateColumns: '48px 1fr', gridTemplateRows: 'auto auto', columnGap: 1, alignItems: 'center' }}>
                      {icon ? (<img src={icon} alt={sym} width={36} height={36} style={{ gridRow: '1 / span 2' }} />) : (<span />)}
                      <Typography sx={{ fontSize: { xs: '1.6rem', sm: '1.8rem' }, fontWeight: 600, lineHeight: 1 }}>
                        {v.amount.toLocaleString('en-US', { maximumFractionDigits: sym === 'USDC' ? 2 : 8 })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {sym} ${v.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Stack>
          </Box>

          {/* Right: Treemap */}
          <Box sx={{ flex: 1, minHeight: { xs: 60, sm: 120 }, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', display: 'flex' }}>
            {entries.map(([sym, v]) => {
              const pct = totalUsd > 0 ? (v.usd / totalUsd) : 0;
              const bg = sym === 'cbBTC' ? '#F59E0B' : (sym === 'WETH' ? '#9CA3AF' : '#10B981');
              return (
                <Box key={sym} sx={{ flex: pct, bgcolor: bg, minWidth: pct > 0 ? 2 : 0 }} title={`${sym}: $${v.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}


