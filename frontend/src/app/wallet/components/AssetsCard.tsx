'use client';

import React from 'react';
import { Card, CardContent, Typography, Stack, Box, Grid, Button, Alert } from '@mui/material';
import { useMediaQuery, useTheme } from '@mui/material';
import { useChainId } from 'wagmi';
import { getChainKey } from '@/config/networks';
import { formatTokenAmountBigint, formatUsd6Bigint } from '@/lib/format';

type Props = {
  chainAssets: Record<string, { address: string; symbol: string; decimals: number; feed?: `0x${string}` }>;
  riskAssets: string[];
  stableBal?: bigint;
  riskBals: bigint[];
  userUsdcBalance?: bigint;
  prices: Record<string, { price: number; decimals: number }>;
  valueUsd?: bigint;
  onDeposit: () => void;
  onWithdraw: () => void;
};

export default function AssetsCard({ chainAssets, riskAssets, stableBal, riskBals, userUsdcBalance, prices, valueUsd, onDeposit, onWithdraw }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const chainId = useChainId();
  const chainKey = getChainKey(chainId);
  const usdcMeta = (chainAssets as any)['USDC'] as { address: string; symbol: string; decimals: number } | undefined;
  const btcMeta = (chainAssets as any)['cbBTC'] as { address: string; symbol: string; decimals: number } | undefined;
  const usdcAmtRaw = (stableBal !== undefined ? stableBal : undefined);
  const btcAmtRaw = (() => {
    if (!btcMeta) return undefined;
    const idx = riskAssets.findIndex(x => x.toLowerCase() === btcMeta.address.toLowerCase());
    return idx === -1 ? undefined : (riskBals[idx] as bigint | undefined);
  })();
  const usdcPrice = (prices?.USDC?.price ?? 1);
  const btcPrice = (prices?.cbBTC?.price ?? prices?.BTC?.price ?? 0);
  const usdcUsd = usdcMeta ? (Number(usdcAmtRaw ?? 0n) / Math.pow(10, usdcMeta.decimals)) * usdcPrice : 0;
  const btcUsd = btcMeta ? (Number(btcAmtRaw ?? 0n) / Math.pow(10, btcMeta.decimals)) * btcPrice : 0;
  const totalUsdNum = Math.max(0, (usdcUsd || 0) + (btcUsd || 0));
  const usdcPct = totalUsdNum > 0 ? (usdcUsd / totalUsdNum) * 100 : 0;
  const btcPct = totalUsdNum > 0 ? 100 - usdcPct : 0;
  return (
    <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold">My Assets</Typography>
        <Box sx={{ mt: 1, mb: 1, borderBottom: '1px solid', borderColor: 'divider' }} />
        <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box sx={{ p: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '48px 1fr', gridTemplateRows: 'auto auto', columnGap: 1, alignItems: 'center' }}>
              <img src="/img/wallet/usdc.svg" alt="USDC" width={36} height={36} style={{ gridRow: '1 / span 2' }} />
              <Typography sx={{ fontSize: { xs: '2rem', sm: '2.2rem' }, fontWeight: 600, lineHeight: 1.1 }}>
                {usdcMeta ? (usdcAmtRaw === undefined ? '-' : formatTokenAmountBigint(usdcAmtRaw, usdcMeta.decimals)) : '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                USDC {usdcMeta ? `$${usdcUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ p: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '48px 1fr', gridTemplateRows: 'auto auto', columnGap: 1, alignItems: 'center' }}>
              <img src="/img/wallet/btc.svg" alt="cbBTC" width={36} height={36} style={{ gridRow: '1 / span 2' }} />
              <Typography sx={{ fontSize: { xs: '2rem', sm: '2.2rem' }, fontWeight: 600, lineHeight: 1.1 }}>
                {btcMeta ? (btcAmtRaw === undefined ? '-' : formatTokenAmountBigint(btcAmtRaw, btcMeta.decimals)) : '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                cbBTC {btcMeta ? `$${btcUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Box sx={{ width: '100%', height: 44, borderRadius: 1, overflow: 'hidden', display: 'flex', border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ width: `${Math.max(0, Math.min(100, usdcPct))}%`, bgcolor: '#65C574', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>{`${Math.round(usdcPct)}%`}</Typography>
            </Box>
            <Box sx={{ width: `${Math.max(0, Math.min(100, btcPct))}%`, bgcolor: '#FF9F10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>{`${Math.round(btcPct)}%`}</Typography>
            </Box>
          </Box>
        </Box>

        {chainKey === 'base-sepolia' && (userUsdcBalance !== undefined) && (userUsdcBalance === 0n) ? (
            <Alert severity="info" sx={{ mt: 3 }}>
              You can claim testnet USDC from the{' '}
              <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Circle Faucet</a>.
            </Alert>
          ) : null
        }

      </CardContent>
    </Card>
  );
}


