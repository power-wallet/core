'use client';

import React from 'react';
import { Box, Grid, Card, CardContent, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { SimulationResult } from '@/lib/types';

interface StatsSummaryProps {
  result: SimulationResult;
}

const StatCard: React.FC<{ label: string; value: string; change?: number; suffix?: string }> = ({ 
  label, 
  value, 
  change,
  suffix = '' 
}) => {
  const isPositive = change !== undefined ? change >= 0 : undefined;
  
  return (
    <Card sx={{ height: '100%', bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h5" fontWeight="bold" color="white">
            {value}{suffix}
          </Typography>
          {isPositive !== undefined && (
            isPositive ? (
              <TrendingUpIcon sx={{ color: 'success.main', fontSize: 20 }} />
            ) : (
              <TrendingDownIcon sx={{ color: 'error.main', fontSize: 20 }} />
            )
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

const StatsSummary: React.FC<StatsSummaryProps> = ({ result }) => {
  const { summary } = result;
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
        Performance Summary
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Total Return"
            value={summary.totalReturn.toFixed(2)}
            change={summary.totalReturn}
            suffix="%"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="CAGR"
            value={summary.cagr.toFixed(2)}
            change={summary.cagr}
            suffix="%"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Max Drawdown"
            value={summary.maxDrawdown.toFixed(2)}
            change={summary.maxDrawdown}
            suffix="%"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Total Trades"
            value={summary.totalTrades.toString()}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Final Portfolio Value"
            value={`$${summary.finalValue.toFixed(2)}`}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="BTC HODL Return"
            value={summary.btcHodlReturn.toFixed(2)}
            change={summary.btcHodlReturn}
            suffix="%"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="BTC HODL CAGR"
            value={summary.btcHodlCagr.toFixed(2)}
            change={summary.btcHodlCagr}
            suffix="%"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Outperformance"
            value={summary.outperformance.toFixed(2)}
            change={summary.outperformance}
            suffix="%"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default StatsSummary;
