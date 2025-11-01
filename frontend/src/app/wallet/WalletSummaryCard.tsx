'use client';

import React from 'react';
import { Card, CardContent, Stack, Box, Typography, Button, Tooltip } from '@mui/material';
import dynamic from 'next/dynamic';
import LaunchIcon from '@mui/icons-material/Launch';
import { useReadContract, useChainId } from 'wagmi';
import { useWalletReads, useStrategyReads } from '@/lib/walletReads';
import appConfig from '@/config/appConfig.json';
import { getChainKey } from '@/config/networks';

type Props = { walletAddress: `0x${string}`; explorerBase: string; feeClient: any };

export default function WalletSummaryCard({ walletAddress, explorerBase, feeClient }: Props) {
  const { valueUsd, strategyAddr, createdAtTs } = useWalletReads(walletAddress);
  const { strategyName, freq, dcaAmount, strategyIdStr, desc } = useStrategyReads(strategyAddr as any);
  const chainId = useChainId();
  const chainKey = getChainKey(chainId);
  const Jazzicon = dynamic(() => import('react-jazzicon'), { ssr: false });
  const jsNumberForAddress = (address: string) => {
    try { return parseInt(address.slice(2, 10), 16); } catch { return 0; }
  };

  const formatUsd6 = (v?: bigint) => {
    if (!v) return '$0.00';
    const num = Number(v) / 1_000_000;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const displayName = (() => {
    try {
      const strategies = (appConfig as any)[chainKey]?.strategies || {};
      const onChainId = String(strategyIdStr || '').trim();
      if (onChainId && (strategies as any)[onChainId]?.name) return (strategies as any)[onChainId].name as string;
      if (onChainId) {
        for (const st of Object.values<any>(strategies)) {
          if (String(st.id || '').trim() === onChainId) return String(st.name || '');
        }
      }
    } catch {}
    return String(strategyName || '').trim() || 'Strategy';
  })();
  const displayDesc = (() => {
    try {
      const strategies = (appConfig as any)[chainKey]?.strategies || {};
      const onChainId = String(strategyIdStr || '').trim();
      if (onChainId && (strategies as any)[onChainId]?.description) return (strategies as any)[onChainId].description as string;
      if (onChainId) {
        for (const st of Object.values<any>(strategies)) {
          if (String(st.id || '').trim() === onChainId) return String(st.description || '');
        }
      }
    } catch {}
    return String(desc || '').trim() || undefined;
  })();
  const shortAddr = `${walletAddress.slice(0, 6)}..${walletAddress.slice(-4)}`;
  const createdAt = createdAtTs ? new Date(Number(createdAtTs) * 1000).toLocaleDateString() : '';
  const dcaAmountDisplay = (() => {
    const v = dcaAmount as bigint | undefined;
    if (!v) return '-';
    const num = Number(v) / 1_000_000; // USDC 6 decimals
    const str = num % 1 === 0 ? String(num) : num.toFixed(2);
    return `${str} USDC`;
  })();
  const freqDays = (() => {
    const f = freq as bigint | undefined;
    if (!f) return '-';
    const days = Math.round(Number(f) / 86400);
    return `${days}d`;
  })();


  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ py: 2, px: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Strategy header */}
        <Box>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>{displayName}</Typography>
          {displayDesc ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: '2.3rem' }}>
              {String(displayDesc)}
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ mt: 0.5, mb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }} />

        {/* Desktop/Tablet layout */}
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr 1fr', rowGap: 0.2, columnGap: 2, alignItems: 'center' }}>
            <Box sx={{ width: 64, height: 64, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gridRow: '1 / span 2' }}>
              <Jazzicon diameter={40} seed={jsNumberForAddress(walletAddress)} />
            </Box>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 500, lineHeight: 1 }}>
              {valueUsd !== undefined ? formatUsd6(valueUsd as bigint) : '-'}
            </Typography>
            <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{createdAt || '-'}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontFamily: 'monospace' }}>{shortAddr}</Typography>
              <Tooltip title="Open in block explorer">
                <a href={`${explorerBase}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" aria-label="Open on explorer" style={{ display: 'inline-flex', alignItems: 'center', color: 'inherit' }}>
                  <LaunchIcon sx={{ fontSize: 16, color: 'inherit' }} />
                </a>
              </Tooltip>
            </Box>
            {/* Labels row */}
            <Typography variant="caption" color="text.secondary">Wallet Value</Typography>
            <Typography variant="caption" color="text.secondary">Created Date</Typography>
            <Typography variant="caption" color="text.secondary">Wallet Address</Typography>
          </Box>
        </Box>

        {/* Mobile layout */}
        <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
          {/* Row 1-2: Icon + Value/Label */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '56px 1fr', columnGap: 2, rowGap: 0.2, alignItems: 'center' }}>
            <Box sx={{ width: 48, height: 48, border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gridRow: '1 / span 2' }}>
              <Jazzicon diameter={36} seed={jsNumberForAddress(walletAddress)} />
            </Box>
            <Typography sx={{ fontSize: '1.8rem', fontWeight: 500, lineHeight: 1 }}>
              {valueUsd !== undefined ? formatUsd6(valueUsd as bigint) : '-'}
            </Typography>
            <Typography variant="caption" color="text.secondary">Asset Value</Typography>
          </Box>

          {/* Row 3-4: Created + Address */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 2, rowGap: 0.2, alignItems: 'center', mt: 3 }}>
            <Typography sx={{ fontSize: '0.95rem', lineHeight: 1 }}>{createdAt || '-'}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontFamily: 'monospace' }}>{shortAddr}</Typography>
              <Tooltip title="Open in block explorer">
                <a href={`${explorerBase}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" aria-label="Open on explorer" style={{ display: 'inline-flex', alignItems: 'center', color: 'inherit' }}>
                  <LaunchIcon sx={{ fontSize: 16, color: 'inherit' }} />
                </a>
              </Tooltip>
            </Box>
            <Typography variant="caption" color="text.secondary">Created date</Typography>
            <Typography variant="caption" color="text.secondary">Wallet Address</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button size="small" variant="outlined" href={`/wallet?address=${walletAddress}`}>Open</Button>
        </Box>
      </CardContent>
    </Card>
  );
}


