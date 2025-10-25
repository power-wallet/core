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
  return (
    <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold">My Assets</Typography>
        {isMobile ? (
          <Stack spacing={0.75} sx={{ mt: 1, minWidth: 0 }}>
            {(['cbBTC', 'USDC', 'WETH'] as const).map((sym) => {
              const m = (chainAssets as any)[sym] as { address: string; symbol: string; decimals: number; feed?: `0x${string}` } | undefined;
              if (!m) return null;
              let amt: bigint | undefined = sym === 'USDC'
                ? stableBal
                : (() => {
                  const idx = riskAssets.findIndex(x => x.toLowerCase() === m.address.toLowerCase());
                  return idx === -1 ? undefined : riskBals[idx];
                })();
              if (amt === undefined) return null;
              const p = prices[m.symbol];
              const usd = p && Number.isFinite(p.price) ? (Number(amt) / 10 ** m.decimals) * p.price : undefined;
              return (
                <Box key={sym} sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                    {formatTokenAmountBigint(amt, m.decimals)} {m.symbol}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {usd !== undefined ? `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                  </Typography>
                </Box>
              );
            })}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
              <Typography variant="body1" sx={{ flexShrink: 0 }} >Total Value</Typography>
              <Typography variant="body1" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
                {formatUsd6Bigint(valueUsd)}
              </Typography>
            </Box>
          </Stack>
        ) : (
          <Grid container spacing={0.5} sx={{ mt: 1, pr: 0.5 }} textAlign={'center'}>
            {(['cbBTC', 'WETH', 'USDC'] as const).map((sym) => {
              const m = (chainAssets as any)[sym] as { address: string; symbol: string; decimals: number; feed?: `0x${string}` } | undefined;
              if (!m) return null;
              let amt: bigint | undefined = sym === 'USDC'
                ? stableBal
                : (() => {
                  const idx = riskAssets.findIndex(x => x.toLowerCase() === m.address.toLowerCase());
                  return idx === -1 ? undefined : riskBals[idx];
                })();
              if (amt === undefined) return null;
              const p = prices[m.symbol];
              const usd = p && Number.isFinite(p.price) ? (Number(amt) / 10 ** m.decimals) * p.price : undefined;
              return (
                <Grid key={sym} item xs={12} sm={6} md={4}>
                  <Stack>
                    <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '1.1rem', pr: 0.1 }}>
                      {formatTokenAmountBigint(amt, m.decimals)} {m.symbol}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '1rem' }}>
                      {usd !== undefined ? `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </Typography>
                  </Stack>
                </Grid>
              );
            })}
            <Grid item xs={12} sm={6} md={4}>
              <Stack>
                <Typography variant="body1" fontWeight="bold">Total Value</Typography>
                <Typography variant="body1" fontWeight="bold">{formatUsd6Bigint(valueUsd)}</Typography>
              </Stack>
            </Grid>
          </Grid>
        )}

        {chainKey === 'base-sepolia' && (userUsdcBalance !== undefined) && (userUsdcBalance === 0n) ? (
            <Alert severity="info" sx={{ mt: 3 }}>
              You can claim testnet USDC from the{' '}
              <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Circle Faucet</a>.
            </Alert>
          ) : null
        }

        <Stack direction="row" spacing={2} sx={{ pt:2, pr: 2,  mt: 'auto', alignSelf: 'flex-end', justifyContent: 'flex-end' }}>
          <Button variant="outlined" size="small" onClick={onDeposit}>Deposit</Button>
          <Button variant="outlined" size="small" onClick={onWithdraw}>Withdraw</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}


