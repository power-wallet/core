'use client';

import React, { useState } from 'react';
import { Container, Box, Typography, Alert, AlertTitle } from '@mui/material';
import SimulatorControls, { type SimulationParams } from '@/components/simulator/SimulatorControls';
import StatsSummary from '@/components/simulator/StatsSummary';
import PriceChart from '@/components/simulator/PriceChart';
import SimulatorCharts from '@/components/simulator/SimulatorCharts';
import TradesTable from '@/components/simulator/TradesTable';
import { runSimulation } from '@/lib/simulator';
import type { SimulationResult } from '@/lib/types';

export default function SimulatorPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunSimulation = async (params: SimulationParams) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const simulationResult = await runSimulation(
        params.initialCapital,
        params.startDate,
        params.endDate
      );
      setResult(simulationResult);
    } catch (err) {
      console.error('Simulation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during simulation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            Strategy Simulator
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Backtest trading strategies with historical data and analyze performance metrics
          </Typography>
        </Box>

        <SimulatorControls onRunSimulation={handleRunSimulation} isLoading={isLoading} />

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            <AlertTitle>Simulation Error</AlertTitle>
            {error}
          </Alert>
        )}

        {result && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Summary Stats */}
            <StatsSummary result={result} />

            {/* Price Chart with Trade Markers */}
            <PriceChart result={result} />

            {/* Charts */}
            <SimulatorCharts result={result} />

            {/* Trades Table */}
            <TradesTable result={result} />
          </Box>
        )}

        {!result && !isLoading && !error && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              px: 2,
              border: '2px dashed #2D2D2D',
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Ready to backtest
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure your simulation parameters above and click &quot;Run Simulation&quot; to begin
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}