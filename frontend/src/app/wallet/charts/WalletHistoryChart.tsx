"use client";

import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ReferenceDot, ReferenceArea } from 'recharts';
import type { WalletHistoryPoint, WalletEvent } from '@/lib/walletHistory';

function formatUsd(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function eventLabel(ev: WalletEvent): string {
  if (ev.kind === 'deposit') return `Deposit ${formatUsd(Number(ev.amount) / 1_000_000)}`;
  if (ev.kind === 'withdrawal') return `Withdrawal ${(Number(ev.amount) / 1_000_000).toFixed(2)}`;
  if (ev.kind === 'swap') return ev.detail ? ev.detail : 'Swap';
  return 'Event';
}

function CustomTooltip({ active, label, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const point: WalletHistoryPoint | undefined = payload[0]?.payload as WalletHistoryPoint | undefined;
  if (!point) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: point.events?.length ? 0.5 : 0 }}>Total {formatUsd(point.totalUsd)}</Typography>
      {point.events && point.events.length ? (
        <Box sx={{ mt: 0.25 }}>
          {point.events.map((ev, idx) => (
            <Typography key={idx} variant="caption" sx={{ display: 'block' }}>{eventLabel(ev)}</Typography>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

export default function WalletHistoryChart({ data }: { data: WalletHistoryPoint[] }) {
  const { depositDots, withdrawalDots, swapBuyDots, swapSellDots } = React.useMemo(() => {
    const dep: { x: string; y: number; label: string }[] = [];
    const wit: { x: string; y: number; label: string }[] = [];
    const swpBuy: { x: string; y: number; label: string }[] = [];
    const swpSell: { x: string; y: number; label: string }[] = [];
    for (const p of data) {
      if (!p.events) continue;
      for (const ev of p.events) {
        const item = { x: p.date, y: p.totalUsd, label: eventLabel(ev) };
        if (ev.kind === 'deposit') dep.push(item);
        else if (ev.kind === 'withdrawal') wit.push(item);
        else if (ev.kind === 'swap') {
          if (ev.side === 'buy') swpBuy.push(item);
          else if (ev.side === 'sell') swpSell.push(item);
          else swpBuy.push(item);
        }
      }
    }
    return { depositDots: dep, withdrawalDots: wit, swapBuyDots: swpBuy, swapSellDots: swpSell };
  }, [data]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Wallet History</Typography>
        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis tickFormatter={(v) => `$${Number(v).toLocaleString('en-US')}`} width={70} />
              <RTooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="totalUsd" stroke="#F59E0B" dot={false} strokeWidth={2} />
              {depositDots.map((d, i) => (
                <ReferenceDot key={`dep-${i}`} x={d.x} y={d.y} r={5} fill="#2e7d32" stroke="none" />
              ))}
              {withdrawalDots.map((d, i) => (
                <ReferenceDot key={`wit-${i}`} x={d.x} y={d.y} r={5} fill="#c62828" stroke="none" />
              ))}
              {swapBuyDots.map((d, i) => (
                <ReferenceDot key={`swpb-${i}`} x={d.x} y={d.y} r={6} fill="#1976d2" stroke="#0d47a1" />
              ))}
              {swapSellDots.map((d, i) => (
                <ReferenceDot key={`swps-${i}`} x={d.x} y={d.y} r={6} fill="#960064" stroke="none" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
        <Box sx={{ mt: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: '#2e7d32', borderRadius: '50%' }} />
            <Typography variant="caption">Deposit</Typography>
          </Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: '#c62828', borderRadius: '50%' }} />
            <Typography variant="caption">Withdrawal</Typography>
          </Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: '#1976d2', borderRadius: '50%' }} />
            <Typography variant="caption">Buy</Typography>
          </Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: '#960064', borderRadius: '50%' }} />
            <Typography variant="caption">Sell</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}


