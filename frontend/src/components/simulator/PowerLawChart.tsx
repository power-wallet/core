'use client';

import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Scatter } from 'recharts';
import type { SimulationResult } from '@/lib/types';

interface Props { result: SimulationResult; }

const TriangleUp = (props: any) => { const { cx, cy, fill } = props; return (<text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={fill} fontSize="14" fontWeight="bold">▲</text>); };
const TriangleDown = (props: any) => { const { cx, cy, fill } = props; return (<text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={fill} fontSize="14" fontWeight="bold">▼</text>); };

const PowerLawChart: React.FC<Props> = ({ result }) => {
  const { dailyPerformance, trades } = result;

  const data = dailyPerformance.map(d => {
    const dayTrades = trades.filter(t => t.date === d.date && t.symbol === 'BTC');
    const btcTrade = dayTrades.at(-1);
    return {
      date: d.date,
      btcPrice: d.btcPrice,
      model: d.btcModel,
      upper: d.btcUpperBand,
      lower: d.btcLowerBand,
      btcBuy: btcTrade?.side === 'BUY' ? btcTrade.price : null,
      btcSell: btcTrade?.side === 'SELL' ? btcTrade.price : null,
      btcTradeDetails: btcTrade ? `${btcTrade.side} ${btcTrade.quantity.toFixed(4)} BTC @ $${btcTrade.price.toLocaleString()}` : null,
    };
  });

  const TooltipContent = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload;
    return (
      <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid #444', padding: 8, borderRadius: 6 }}>
        <div style={{ color: '#fff', fontSize: 12 }}>{p.date}</div>
        <div style={{ color: '#F97316', fontSize: 12 }}>BTC: ${p.btcPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        {p.model && <div style={{ color: '#60A5FA', fontSize: 12 }}>Model: ${p.model.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>}
        {p.upper && <div style={{ color: '#34D399', fontSize: 12 }}>Upper: ${p.upper.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>}
        {p.lower && <div style={{ color: '#F87171', fontSize: 12 }}>Lower: ${p.lower.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>}
        {p.btcTradeDetails && (
          <div style={{ color: p.btcBuy ? '#10B981' : '#EF4444', fontSize: 12, marginTop: 4 }}>{p.btcTradeDetails}</div>
        )}
      </div>
    );
  };

  return (
    <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D', mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight="bold">Power Law & Signals</Typography>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#999" tick={{ fontSize: 12 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
            <YAxis stroke="#999" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<TooltipContent />} />
            <Legend />

            <Line type="monotone" dataKey="btcPrice" name="BTC Price" stroke="#F97316" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="model" name="Power Law" stroke="#60A5FA" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="upper" name="Upper Band" stroke="#34D399" strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="lower" name="Lower Band" stroke="#F87171" strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls />

            <Scatter dataKey="btcBuy" name="BTC Buy" fill="#10B981" shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleUp {...props} />)} />
            <Scatter dataKey="btcSell" name="BTC Sell" fill="#EF4444" shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleDown {...props} />)} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default PowerLawChart;



