'use client';

import React from 'react';
import { Card, CardContent, Stack, Box, Typography, Button, Tooltip } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import { useReadContract } from 'wagmi';
import { useWalletReads, useStrategyReads } from '@/lib/walletReads';

type Props = { walletAddress: `0x${string}`; explorerBase: string; feeClient: any };

export default function WalletSummaryCard({ walletAddress, explorerBase, feeClient }: Props) {
  const { valueUsd, strategyAddr, createdAtTs } = useWalletReads(walletAddress);
  const { strategyName, freq, dcaAmount } = useStrategyReads(strategyAddr as any);
  const isSimple = String(strategyName || '').trim() === 'Simple BTC DCA';

  const formatUsd6 = (v?: bigint) => {
    if (!v) return '$0.00';
    const num = Number(v) / 1_000_000;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const displayName = String(strategyName || '').trim() || 'Strategy';
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
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ py: 1.5, px: 1.5 }}>
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Wallet Address</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, justifyContent: 'flex-end', flex: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortAddr}</Typography>
              <Tooltip title="Open in block explorer">
                <a href={`${explorerBase}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" aria-label="Open on explorer" style={{ display: 'inline-flex', alignItems: 'center', color: 'inherit' }}>
                  <LaunchIcon sx={{ fontSize: 14, color: 'inherit' }} />
                </a>
              </Tooltip>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Total Value</Typography>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
              {formatUsd6(valueUsd as bigint)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Strategy</Typography>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
              {displayName} {isSimple ? `- ${dcaAmountDisplay} ${freqDays}` : `- ${freqDays}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Created</Typography>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
              {createdAt}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0, pt: 2 }}>
            <Button size="small" variant="outlined" href={`/wallet?address=${walletAddress}`}>Open</Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}


