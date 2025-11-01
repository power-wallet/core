'use client';

import React from 'react';
import { Card, CardContent, Typography, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Tooltip, Box } from '@mui/material';
import { formatDateOnly, formatDateTime } from '@/lib/format';

type Props = {
  swaps: any[];
  addressToMeta: (addr: string | undefined) => { symbol: string; decimals: number } | undefined;
  chainAssets: Record<string, { address: string; symbol: string; decimals: number }>;
};

export default function SwapsCard({ swaps, addressToMeta, chainAssets }: Props) {
  return (
    <Card variant="outlined" sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="subtitle1" fontWeight="bold">Swaps</Typography>
        <Box sx={{ mt: 1, mb: 1, borderBottom: '1px solid', borderColor: 'divider' }} />
        <TableContainer sx={{ mt: 1, overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 680, whiteSpace: 'nowrap' }}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Side</TableCell>
                <TableCell>Asset</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Price (USDC)</TableCell>
                <TableCell align="right">Value (USDC)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {((Array.isArray(swaps) ? swaps : []).length === 0) && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">No swaps yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {[...(Array.isArray(swaps) ? swaps : [])].sort((a: any, b: any) => Number(b.timestamp) - Number(a.timestamp)).map((s: any, idx: number) => {
                const tokenIn = String(s.tokenIn);
                const tokenOut = String(s.tokenOut);
                const amountIn = s.amountIn as bigint;
                const amountOut = s.amountOut as bigint;
                const tokenInMeta = addressToMeta(tokenIn);
                const tokenOutMeta = addressToMeta(tokenOut);
                const isBuy = tokenInMeta?.symbol === 'USDC';
                const riskMeta = isBuy ? tokenOutMeta : tokenInMeta;
                const stableDec = (chainAssets as any)['USDC']?.decimals ?? 6;
                const riskDec = riskMeta?.decimals ?? 18;
                let priceNum: number | null = null;
                if (isBuy && riskMeta) {
                  const usdcSold = Number(amountIn) / 10 ** stableDec;
                  const riskBought = Number(amountOut) / 10 ** riskDec;
                  if (riskBought > 0) priceNum = usdcSold / riskBought;
                } else if (!isBuy && riskMeta) {
                  const usdcBought = Number(amountOut) / 10 ** stableDec;
                  const riskSold = Number(amountIn) / 10 ** riskDec;
                  if (riskSold > 0) priceNum = usdcBought / riskSold;
                }
                const amountRisk = isBuy ? (Number(amountOut) / 10 ** riskDec) : (Number(amountIn) / 10 ** riskDec);
                const valueUsdc = priceNum !== null ? amountRisk * priceNum : null;
                return (
                  <TableRow key={`sw-${idx}`}>
                    <TableCell>
                      <Tooltip title={formatDateTime(s.timestamp)} placement="top" disableFocusListener disableTouchListener>
                        <span>{formatDateOnly(s.timestamp)}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{isBuy ? 'BUY' : 'SELL'}</TableCell>
                    <TableCell>{riskMeta?.symbol || '-'}</TableCell>
                    <TableCell align="right">{Number.isFinite(amountRisk) ? amountRisk.toLocaleString('en-US', { maximumFractionDigits: 8 }) : '-'}</TableCell>
                    <TableCell align="right">{priceNum !== null ? `$${priceNum.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '-'}</TableCell>
                    <TableCell align="right">{valueUsdc !== null ? `$${valueUsdc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}


