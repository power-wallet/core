'use client';

import React from 'react';
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
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#D1D5DB' }} />
                  <Line
                    type="monotone"
                    dataKey="strategy"
                    name="Strategy"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="hodl"
                    name="BTC HODL"
                    stroke="#FB923C"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Portfolio Allocation Chart */}
        <Grid item xs={12} md={6}>
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
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#D1D5DB' }} />
                  <Area
                    type="monotone"
                    dataKey="USDC"
                    stackId="1"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="BTC"
                    stackId="1"
                    stroke="#F59E0B"
                    fill="#F59E0B"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="ETH"
                    stackId="1"
                    stroke="#9CA3AF"
                    fill="#9CA3AF"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Drawdown Chart */}
        <Grid item xs={12} md={6}>
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
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#D1D5DB' }} />
                  <Line
                    type="monotone"
                    dataKey="strategy"
                    name="Strategy DD"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="hodl"
                    name="HODL DD"
                    stroke="#F97316"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
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
