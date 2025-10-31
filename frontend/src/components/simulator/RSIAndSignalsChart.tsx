'use client';

import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Scatter, Brush } from 'recharts';
import type { SimulationResult } from '@/lib/types';

interface Props {
  result: SimulationResult;
}

const TriangleUp = (props: any) => {
  const { cx, cy, fill } = props; return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={fill} fontSize="14" fontWeight="bold">▲</text>
  );
};
const TriangleDown = (props: any) => {
  const { cx, cy, fill } = props; return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={fill} fontSize="14" fontWeight="bold">▼</text>
  );
};

const RSIAndSignalsChart: React.FC<Props> = ({ result }) => {
  const data = (result.rsiSignals || []).map(d => ({
    date: d.date,
    btcRsi: d.btcRsi,
    ethRsi: d.ethRsi,
    entryLine: d.entryLine,
    exitLine: d.exitLine,
    btcBuy: d.btcBuy ? d.btcRsi : null,
    btcSell: d.btcSell ? d.btcRsi : null,
    ethBuy: d.ethBuy ? d.ethRsi : null,
    ethSell: d.ethSell ? d.ethRsi : null,
    btcBuyDetail: d.btcBuyDetail,
    btcSellDetail: d.btcSellDetail,
    ethBuyDetail: d.ethBuyDetail,
    ethSellDetail: d.ethSellDetail,
    bothEligible: d.bothEligible ? 100 : null,
    bothAllocated: d.bothAllocated ? 98 : null,
  }));

  const TooltipContent = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload;
    return (
      <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid #444', padding: 8, borderRadius: 6 }}>
        <div style={{ color: '#fff', fontSize: 12 }}>{p.date}</div>
        <div style={{ color: '#3B82F6', fontSize: 12 }}>BTC RSI: {p.btcRsi?.toFixed(2)}</div>
        <div style={{ color: '#9CA3AF', fontSize: 12 }}>ETH RSI: {p.ethRsi?.toFixed(2)}</div>
        {(p.btcBuyDetail || p.btcSellDetail) && (
          <div style={{ color: p.btcBuyDetail ? '#10B981' : '#EF4444', fontSize: 12, marginTop: 4 }}>
            {p.btcBuyDetail || p.btcSellDetail}
          </div>
        )}
        {(p.ethBuyDetail || p.ethSellDetail) && (
          <div style={{ color: p.ethBuyDetail ? '#10B981' : '#EF4444', fontSize: 12 }}>
            {p.ethBuyDetail || p.ethSellDetail}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D', mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight="bold">RSI & Signals</Typography>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#999" tick={{ fontSize: 12 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
            <YAxis domain={[0, 100]} stroke="#999" tick={{ fontSize: 12 }} />
            <Tooltip content={<TooltipContent />} />
            <Legend />

            {/* RSI lines */}
            <Line type="monotone" dataKey="btcRsi" name="BTC RSI" stroke="#F97316" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ethRsi" name="ETH RSI" stroke="#9CA3AF" strokeWidth={2} dot={false} />

            {/* Thresholds (vary per day by regime) */}
            <Line type="monotone" dataKey="entryLine" name="Entry threshold" stroke="#10B981" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="exitLine" name="Exit threshold" stroke="#EF4444" strokeWidth={1} strokeDasharray="4 4" dot={false} />

            {/* Trade markers on their respective RSI lines */}
            <Scatter dataKey="btcBuy" legendType="none" fill="#10B981" shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleUp {...props} />)} />
            <Scatter dataKey="btcSell" legendType="none" fill="#EF4444" shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleDown {...props} />)} />
            <Scatter dataKey="ethBuy" legendType="none" fill="#10B981" shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleUp {...props} />)} />
            <Scatter dataKey="ethSell" legendType="none" fill="#EF4444" shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleDown {...props} />)} />

            {/* Both-eligible / both-allocated strips near the top */}
            <Scatter dataKey="bothEligible" name="Both eligible" fill="#3B82F6" />
            <Scatter dataKey="bothAllocated" name="Both allocated" fill="#FB923C" />

            <Brush
              dataKey="date"
              stroke="#F59E0B"
              fill="#0F172A"
              travellerWidth={8}
              height={24}
              tickFormatter={(v)=>new Date(v).toLocaleDateString('en-US',{month:'short',year:'2-digit'})}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default RSIAndSignalsChart;


