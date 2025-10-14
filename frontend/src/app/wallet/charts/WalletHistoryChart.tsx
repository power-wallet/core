"use client";

import React from 'react';
import { Card, CardContent, Typography, Box, useMediaQuery, useTheme, ToggleButtonGroup, ToggleButton, FormGroup, FormControlLabel, Checkbox } from '@mui/material';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ReferenceDot } from 'recharts';
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
      <Typography variant="body2" sx={{ fontWeight: 600 }}>Total {formatUsd(point.totalUsd)}</Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: point.events?.length ? 0.5 : 0 }}>
        {`USDC: ${formatUsd(point.usdcUsd)}  BTC: ${formatUsd(point.btcUsd)}  ETH: ${formatUsd(point.ethUsd)}`}
      </Typography>
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mode, setMode] = React.useState<'value' | 'assets'>('value');
  const [showUsdc, setShowUsdc] = React.useState(true);
  const [showEth, setShowEth] = React.useState(true);
  const [showBtc, setShowBtc] = React.useState(true);
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Wallet History</Typography>
          <ToggleButtonGroup
            size="small"
            value={mode}
            exclusive
            onChange={(_, v) => { if (v) setMode(v); }}
          >
            <ToggleButton value="value">Value</ToggleButton>
            <ToggleButton value="assets">Assets</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            {mode === 'value' ? (
              <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
                <YAxis tickFormatter={(v) => `$${Number(v).toLocaleString('en-US')}`} width={70} />
                <RTooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="totalUsd" stroke="#14b8a6" fill="url(#valueFill)" strokeWidth={2} />
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
              </AreaChart>
            ) : (
              <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="btcFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ethFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#9ca3af" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="usdcFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2e7d32" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2e7d32" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
                <YAxis tickFormatter={(v) => `$${Number(v).toLocaleString('en-US')}`} width={70} />
                <RTooltip content={<CustomTooltip />} />
                {showUsdc ? (
                  <Area type="monotone" dataKey="usdcUsd" stackId="1" stroke="#2e7d32" fill="url(#usdcFill)" strokeWidth={2} />
                ) : null}
                {showEth ? (
                  <Area type="monotone" dataKey="ethUsd" stackId="1" stroke="#9ca3af" fill="url(#ethFill)" strokeWidth={2} />
                ) : null}
                {showBtc ? (
                  <Area type="monotone" dataKey="btcUsd" stackId="1" stroke="#F59E0B" fill="url(#btcFill)" strokeWidth={2} />
                ) : null}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </Box>
        <Box sx={{ mt: 1, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          {mode === 'assets' ? (
            <FormGroup row>
              <FormControlLabel control={<Checkbox size="small" checked={showUsdc} onChange={(e) => setShowUsdc(e.target.checked)} />} label={<Typography variant="caption">USDC</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={showEth} onChange={(e) => setShowEth(e.target.checked)} />} label={<Typography variant="caption">ETH</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={showBtc} onChange={(e) => setShowBtc(e.target.checked)} />} label={<Typography variant="caption">BTC</Typography>} />
            </FormGroup>
          ) : <span />}
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


