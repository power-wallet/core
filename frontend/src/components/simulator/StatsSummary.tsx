'use client';

import React from 'react';
import { Box, Grid, Card, CardContent, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import type { SimulationResult } from '@/lib/types';

interface StatsSummaryProps {
  result: SimulationResult;
}

// Card with strategy vs benchmark comparison
const ComparisonCard: React.FC<{ 
  label: string; 
  strategyValue: string; 
  benchmarkValue: string;
  strategyChange?: number;
  suffix?: string;
  invertSign?: boolean; // when true, smaller (more negative) is better (e.g., drawdown)
}> = ({ label, strategyValue, benchmarkValue, strategyChange, suffix = '', invertSign = false }) => {
  const effectiveChange = strategyChange !== undefined 
    ? (invertSign ? -strategyChange : strategyChange) 
    : undefined;
  const isPositive = effectiveChange !== undefined ? effectiveChange >= 0 : undefined;
  const color = isPositive !== undefined 
    ? (isPositive ? 'success.main' : 'error.main')
    : 'white';
  
  return (
    <Card sx={{ height: '100%', bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        
        {/* Strategy Value - Primary */}
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <Typography 
            variant="h4" 
            fontWeight="bold" 
            sx={{ color }}
          >
            {strategyValue}{suffix}
          </Typography>
          {isPositive !== undefined && (
            isPositive ? (
              <TrendingUpIcon sx={{ color: 'success.main', fontSize: 24 }} />
            ) : (
              <TrendingDownIcon sx={{ color: 'error.main', fontSize: 24 }} />
            )
          )}
        </Box>
        
        {/* Benchmark Value - Secondary */}
        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{ fontSize: '0.875rem' }}
        >
          BTC HODL: {benchmarkValue}{suffix}
        </Typography>
      </CardContent>
    </Card>
  );
};

// Card for strategy-only metrics (optionally with trend)
const StatCard: React.FC<{ label: string; value: string; suffix?: string; change?: number }> = ({ 
  label, 
  value, 
  suffix = '',
  change,
}) => {
  const isPositive = change !== undefined ? change >= 0 : undefined;
  const color = change !== undefined ? (isPositive ? 'success.main' : 'error.main') : 'white';
  return (
    <Card sx={{ height: '100%', bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h4" fontWeight="bold" sx={{ color }}>
            {value}{suffix}
          </Typography>
          {isPositive !== undefined && (
            isPositive ? (
              <TrendingUpIcon sx={{ color: 'success.main', fontSize: 24 }} />
            ) : (
              <TrendingDownIcon sx={{ color: 'error.main', fontSize: 24 }} />
            )
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

const StatsSummary: React.FC<StatsSummaryProps> = ({ result }) => {
  const { summary } = result;
  
  // Calculate absolute gains (new metric)
  const strategyGains = summary.finalValue - summary.initialCapital;
  const btcHodlFinalValue = summary.initialCapital * (1 + summary.btcHodlReturn / 100);
  const btcHodlGains = btcHodlFinalValue - summary.initialCapital;
  
  // Format USD values with comma separator
  const formatUSD = (value: number): string => {
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
        Performance Summary
      </Typography>
      
      <Grid container spacing={2}>
        {/* Final Portfolio Value */}
        <Grid item xs={12} sm={6} md={3}>
          <ComparisonCard
            label="Final Portfolio Value"
            strategyValue={`$${formatUSD(summary.finalValue)}`}
            benchmarkValue={`$${formatUSD(btcHodlFinalValue)}`}
          />
        </Grid>
        
        {/* Absolute Gains */}
        <Grid item xs={12} sm={6} md={3}>
          <ComparisonCard
            label="Absolute Gains"
            strategyValue={`$${formatUSD(strategyGains)}`}
            benchmarkValue={`$${formatUSD(btcHodlGains)}`}
            strategyChange={strategyGains}
          />
        </Grid>
        
        {/* Total Return % */}
        <Grid item xs={12} sm={6} md={3}>
          <ComparisonCard
            label="Total Return"
            strategyValue={summary.totalReturn.toFixed(2)}
            benchmarkValue={summary.btcHodlReturn.toFixed(2)}
            strategyChange={summary.totalReturn}
            suffix="%"
          />
        </Grid>
        
        {/* CAGR */}
        <Grid item xs={12} sm={6} md={3}>
          <ComparisonCard
            label="CAGR"
            strategyValue={summary.cagr.toFixed(2)}
            benchmarkValue={summary.btcHodlCagr.toFixed(2)}
            strategyChange={summary.cagr}
            suffix="%"
          />
        </Grid>
        
        {/* Max Drawdown (invert sign so smaller absolute drawdown is greener) */}
        <Grid item xs={12} sm={6} md={3}>
          <ComparisonCard
            label="Max Drawdown"
            strategyValue={summary.maxDrawdown.toFixed(2)}
            benchmarkValue={summary.btcHodlMaxDrawdown.toFixed(2)}
            strategyChange={summary.maxDrawdown}
            suffix="%"
            invertSign
          />
        </Grid>
        
        {/* Outperformance (green if >= 0, red otherwise) */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            label="Outperformance"
            value={summary.outperformance.toFixed(2)}
            suffix="%"
            change={summary.outperformance}
          />
        </Grid>
        
        {/* Sharpe Ratio */}
        <Grid item xs={12} sm={6} md={3}>
          <ComparisonCard
            label="Sharpe Ratio"
            strategyValue={summary.sharpeRatio.toFixed(2)}
            benchmarkValue={summary.btcHodlSharpeRatio.toFixed(2)}
            strategyChange={summary.sharpeRatio - summary.btcHodlSharpeRatio}
          />
        </Grid>
        
        {/* Sortino Ratio */}
        <Grid item xs={12} sm={6} md={3}>
          <ComparisonCard
            label="Sortino Ratio"
            strategyValue={summary.sortinoRatio.toFixed(2)}
            benchmarkValue={summary.btcHodlSortinoRatio.toFixed(2)}
            strategyChange={summary.sortinoRatio - summary.btcHodlSortinoRatio}
          />
        </Grid>
        
        {/* Removed Total Trades card as requested */}
      </Grid>
    </Box>
  );
};

export default StatsSummary;
