'use client';

import React, { useMemo, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent } from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { SimulationResult } from '@/lib/types';

interface SimulatorChartsProps {
  result: SimulationResult;
}

const SimulatorCharts: React.FC<SimulatorChartsProps> = ({ result }) => {
  const { dailyPerformance } = result;

  // Prepare data for portfolio value chart
  const portfolioData = dailyPerformance.map(d => ({
    date: d.date,
    strategy: d.totalValue,
    hodl: d.btcHodlValue,
  }));

  // Prepare data for allocation chart (stacked area)
  const allocationData = dailyPerformance.map(d => ({
    date: d.date,
    USDC: d.cash,
    BTC: d.btcValue,
    ETH: d.ethValue,
  }));

  // Prepare data for drawdown chart
  const drawdownData = dailyPerformance.map(d => ({
    date: d.date,
    strategy: d.drawdown,
    hodl: d.btcHodlDrawdown,
  }));

  // Visibility toggles
  const [showPvStrategy, setShowPvStrategy] = useState(true);
  const [showPvHodl, setShowPvHodl] = useState(true);
  const [showDdStrategy, setShowDdStrategy] = useState(true);
  const [showDdHodl, setShowDdHodl] = useState(true);
  const [showUSDC, setShowUSDC] = useState(true);
  const [showBTC, setShowBTC] = useState(true);
  const [showETH, setShowETH] = useState(true);

  // Dynamic Y domains based on visible series
  const pvDomain = useMemo(() => {
    const keys: Array<'strategy'|'hodl'> = [];
    if (showPvStrategy) keys.push('strategy');
    if (showPvHodl) keys.push('hodl');
    const values: number[] = [];
    for (const d of portfolioData) {
      for (const k of keys) {
        const v = (d as any)[k];
        if (typeof v === 'number' && isFinite(v)) values.push(v);
      }
    }
    if (values.length === 0) return ['auto', 'auto'] as const;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.05;
    return [Math.max(0, min - pad), max + pad] as const;
  }, [portfolioData, showPvStrategy, showPvHodl]);

  const ddDomain = useMemo(() => {
    const keys: Array<'strategy'|'hodl'> = [];
    if (showDdStrategy) keys.push('strategy');
    if (showDdHodl) keys.push('hodl');
    const values: number[] = [];
    for (const d of drawdownData) {
      for (const k of keys) {
        const v = (d as any)[k];
        if (typeof v === 'number' && isFinite(v)) values.push(v);
      }
    }
    if (values.length === 0) return ['auto', 'auto'] as const;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.05;
    return [min - pad, max + pad] as const;
  }, [drawdownData, showDdStrategy, showDdHodl]);

  const allocDomain = useMemo(() => {
    // Sum only visible series for each day
    const totals = allocationData.map(d => (showUSDC ? d.USDC : 0) + (showBTC ? d.BTC : 0) + (showETH ? d.ETH : 0));
    const max = totals.length ? Math.max(...totals) : 0;
    return [0, max * 1.05] as const;
  }, [allocationData, showUSDC, showBTC, showETH]);

  const getLegendKey = (e: any): string | undefined => e?.dataKey ?? e?.payload?.dataKey ?? e?.value;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          sx={{
            bgcolor: '#1A1A1A',
            border: '1px solid #2D2D2D',
            p: 1.5,
            borderRadius: 1,
          }}
        >
          <Typography variant="caption" sx={{ color: '#D1D5DB' }}>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Typography
              key={index}
              variant="caption"
              sx={{ color: entry.color, display: 'block' }}
            >
              {entry.name}: ${entry.value?.toFixed(2) || entry.value?.toFixed(2) + '%'}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
        Performance Charts
      </Typography>

      <Grid container spacing={3}>
        {/* Portfolio Value Chart */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Portfolio Value Over Time
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={portfolioData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
                  <XAxis
                    dataKey="date"
                    stroke="#D1D5DB"
                    tick={{ fill: '#D1D5DB', fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis
                    stroke="#D1D5DB"
                    tick={{ fill: '#D1D5DB', fontSize: 12 }}
                    tickFormatter={(value) => `$${(value as number).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    domain={pvDomain as any}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ color: '#D1D5DB', cursor: 'pointer' }}
                    onClick={(e: any) => {
                      const key = getLegendKey(e);
                      if (key === 'strategy' || key === 'Strategy') setShowPvStrategy(v => !v);
                      if (key === 'hodl' || key === 'BTC HODL') setShowPvHodl(v => !v);
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="strategy"
                    name="Strategy"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    hide={!showPvStrategy}
                  />
                  <Line
                    type="monotone"
                    dataKey="hodl"
                    name="BTC HODL"
                    stroke="#FB923C"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                    hide={!showPvHodl}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Portfolio Allocation Chart */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Portfolio Allocation
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={allocationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
                  <XAxis
                    dataKey="date"
                    stroke="#D1D5DB"
                    tick={{ fill: '#D1D5DB', fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis
                    stroke="#D1D5DB"
                    tick={{ fill: '#D1D5DB', fontSize: 12 }}
                    tickFormatter={(value) => `$${(value as number).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    domain={allocDomain as any}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ color: '#D1D5DB', cursor: 'pointer' }}
                    onClick={(e: any) => {
                      const key = getLegendKey(e);
                      if (key === 'USDC') setShowUSDC(v => !v);
                      if (key === 'BTC') setShowBTC(v => !v);
                      if (key === 'ETH') setShowETH(v => !v);
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="USDC"
                    stackId="1"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.6}
                    hide={!showUSDC}
                  />
                  <Area
                    type="monotone"
                    dataKey="BTC"
                    stackId="1"
                    stroke="#F59E0B"
                    fill="#F59E0B"
                    fillOpacity={0.6}
                    hide={!showBTC}
                  />
                  <Area
                    type="monotone"
                    dataKey="ETH"
                    stackId="1"
                    stroke="#9CA3AF"
                    fill="#9CA3AF"
                    fillOpacity={0.6}
                    hide={!showETH}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Drawdown Chart */}
        <Grid item xs={12}>
          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Drawdown Comparison
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={drawdownData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2D" />
                  <XAxis
                    dataKey="date"
                    stroke="#D1D5DB"
                    tick={{ fill: '#D1D5DB', fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis
                    stroke="#D1D5DB"
                    tick={{ fill: '#D1D5DB', fontSize: 12 }}
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    domain={ddDomain as any}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ color: '#D1D5DB', cursor: 'pointer' }}
                    onClick={(e: any) => {
                      const key = getLegendKey(e);
                      if (key === 'strategy' || key === 'Strategy DD') setShowDdStrategy(v => !v);
                      if (key === 'hodl' || key === 'HODL DD') setShowDdHodl(v => !v);
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="strategy"
                    name="Strategy DD"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    hide={!showDdStrategy}
                  />
                  <Line
                    type="monotone"
                    dataKey="hodl"
                    name="HODL DD"
                    stroke="#F97316"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                    hide={!showDdHodl}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SimulatorCharts;
