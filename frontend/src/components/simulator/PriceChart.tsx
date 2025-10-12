'use client';

import React, { useMemo, useState } from 'react';
import { Box, Card, CardContent, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Scatter,
  ComposedChart
} from 'recharts';
import type { SimulationResult } from '@/lib/types';

interface PriceChartProps {
  result: SimulationResult;
}

// Custom triangle up shape for buy markers (▲ U+25B2)
const TriangleUp = (props: any) => {
  const { cx, cy, fill } = props;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={fill}
      fontSize="16"
      fontWeight="bold"
    >
      ▲
    </text>
  );
};

// Custom triangle down shape for sell markers (▼ U+25BC)
const TriangleDown = (props: any) => {
  const { cx, cy, fill } = props;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={fill}
      fontSize="16"
      fontWeight="bold"
    >
      ▼
    </text>
  );
};

const PriceChart: React.FC<PriceChartProps> = ({ result }) => {
  const { dailyPerformance, trades } = result;
  const showSma50 = useMemo(() => result.strategyId === 'btc-trend-following', [result.strategyId]);
  const hasEth = useMemo(() => {
    const anyEthPrices = dailyPerformance.some((d) => (d.ethPrice || 0) > 0);
    const anyEthTrades = trades.some((t) => t.symbol === 'ETH');
    return anyEthPrices || anyEthTrades;
  }, [dailyPerformance, trades]);
  
  // Use precomputed SMA from dailyPerformance when present (trend following)
  const btcSma50: Array<number | null> = useMemo(() => {
    if (!showSma50) return dailyPerformance.map(() => null);
    return dailyPerformance.map((d) => (d.btcSma50 != null ? d.btcSma50 : null));
  }, [dailyPerformance, showSma50]);

  // Prepare chart data with prices, optional SMA, and trade markers
  const chartData = dailyPerformance.map((day, idx) => {
    // Find trades on this day
    const dayTrades = trades.filter(t => t.date === day.date);
    const btcTrade = dayTrades.find(t => t.symbol === 'BTC');
    const ethTrade = dayTrades.find(t => t.symbol === 'ETH');
    
    return {
      date: day.date,
      btcPrice: day.btcPrice,
      ethPrice: day.ethPrice,
      btcSma: btcSma50[idx],
      // Trade markers (use actual trade prices for marker position)
      btcBuy: btcTrade?.side === 'BUY' ? btcTrade.price : null,
      btcSell: btcTrade?.side === 'SELL' ? btcTrade.price : null,
      ethBuy: ethTrade?.side === 'BUY' ? ethTrade.price : null,
      ethSell: ethTrade?.side === 'SELL' ? ethTrade.price : null,
      // Trade details for tooltip
      btcTradeDetails: btcTrade ? `${btcTrade.side} ${btcTrade.quantity.toFixed(6)} BTC for $${(btcTrade.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
      ethTradeDetails: ethTrade ? `${ethTrade.side} ${ethTrade.quantity.toFixed(6)} ETH for $${(ethTrade.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Box
          sx={{
            bgcolor: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid #444',
            borderRadius: 1,
            p: 1.5,
          }}
        >
          <Typography variant="caption" color="white" fontWeight="bold">
            {data.date}
          </Typography>
          {data.btcPrice && (
            <Typography variant="caption" display="block" sx={{ color: '#F97316' }}>
              BTC: ${data.btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          )}
          {showSma50 && data.btcSma && (
            <Typography variant="caption" display="block" sx={{ color: '#22C55E' }}>
              BTC 50D SMA: ${data.btcSma.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          )}
          {hasEth && data.ethPrice && (
            <Typography variant="caption" display="block" sx={{ color: '#9CA3AF' }}>
              ETH: ${data.ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          )}
          {data.btcTradeDetails && (
            <Typography variant="caption" display="block" sx={{ color: data.btcBuy ? '#10B981' : '#EF4444', mt: 0.5 }}>
              {data.btcTradeDetails}
            </Typography>
          )}
          {hasEth && data.ethTradeDetails && (
            <Typography variant="caption" display="block" sx={{ color: data.ethBuy ? '#10B981' : '#EF4444', mt: 0.5 }}>
              {data.ethTradeDetails}
            </Typography>
          )}
        </Box>
      );
    }
    return null;
  };

  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const handleScaleChange = (_: any, next: 'linear' | 'log' | null) => {
    if (next) setScale(next);
  };

  const leftTickFormatter = useMemo(() => (value: number) => `$${(value / 1000).toFixed(0)}k`, []);
  const rightTickFormatter = useMemo(() => (value: number) => `$${(value / 1000).toFixed(1)}k`, []);
  const titleAssets = hasEth ? 'Asset Prices & Trades' : 'BTC Price & Trades';
  return (
    <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D', mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            {titleAssets}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={scale}
            onChange={handleScaleChange}
            sx={{
              '& .MuiToggleButton-root': {
                color: '#D1D5DB',
                borderColor: '#2D2D2D',
              },
              '& .Mui-selected': {
                color: '#111827',
                backgroundColor: '#F59E0B',
              },
            }}
          >
            <ToggleButton value="linear">Linear</ToggleButton>
            <ToggleButton value="log">Log</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis 
              dataKey="date" 
              stroke="#999"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            {/* Left Y-axis for BTC */}
            <YAxis 
              yAxisId="left"
              stroke="#F97316"
              tick={{ fontSize: 12 }}
              scale={scale}
              domain={['auto','auto']}
              allowDataOverflow
              tickFormatter={leftTickFormatter}
              label={{ value: 'BTC Price', angle: -90, position: 'insideLeft', style: { fill: '#F97316' } }}
            />
            {/* Right Y-axis for ETH (only when ETH present) */}
            {hasEth && (
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#9CA3AF"
                tick={{ fontSize: 12 }}
                scale={scale}
                domain={['auto','auto']}
                allowDataOverflow
                tickFormatter={rightTickFormatter}
                label={{ value: 'ETH Price', angle: 90, position: 'insideRight', style: { fill: '#9CA3AF' } }}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {/* BTC Price Line */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="btcPrice" 
              stroke="#F97316" 
              strokeWidth={2}
              dot={false}
              name="BTC Price"
              connectNulls
            />

            {/* BTC 50D SMA (trend following only) */}
            {showSma50 && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="btcSma"
                stroke="#22C55E"
                strokeWidth={2}
                dot={false}
                name="BTC 50D SMA"
                connectNulls
                strokeDasharray="5 3"
              />
            )}
            
            {/* ETH Price Line */}
            {hasEth && (
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="ethPrice" 
                stroke="#9CA3AF" 
                strokeWidth={2}
                dot={false}
                name="ETH Price"
                connectNulls
              />
            )}
            
            {/* BTC Buy Markers */}
            <Scatter 
              yAxisId="left"
              dataKey="btcBuy" 
              fill="#10B981" 
              shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleUp {...props} />)}
              name="BTC Buy"
            />
            
            {/* BTC Sell Markers */}
            <Scatter 
              yAxisId="left"
              dataKey="btcSell" 
              fill="#EF4444" 
              shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleDown {...props} />)}
              name="BTC Sell"
            />
            
            {/* ETH Buy Markers */}
            {hasEth && (
              <Scatter 
                yAxisId="right"
                dataKey="ethBuy" 
                fill="#10B981" 
                shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleUp {...props} />)}
                name="ETH Buy"
              />
            )}
            
            {/* ETH Sell Markers */}
            {hasEth && (
              <Scatter 
                yAxisId="right"
                dataKey="ethSell" 
                fill="#EF4444" 
                shape={(props: any) => (props?.cy == null || Number.isNaN(props.cy) ? <g /> : <TriangleDown {...props} />)}
                name="ETH Sell"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default PriceChart;

