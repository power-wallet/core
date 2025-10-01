'use client';

import React, { useState } from 'react';
import { Container, Box, Typography, Alert, AlertTitle, Card, CardContent, Collapse, Button } from '@mui/material';
import SimulatorControls, { type SimulationParams } from '@/components/simulator/SimulatorControls';
import StatsSummary from '@/components/simulator/StatsSummary';
import PriceChart from '@/components/simulator/PriceChart';
import RSIAndSignalsChart from '@/components/simulator/RSIAndSignalsChart';
import SimulatorCharts from '@/components/simulator/SimulatorCharts';
import TradesTable from '@/components/simulator/TradesTable';
import { runSimulation } from '@/lib/simulator';
import type { SimulationResult } from '@/lib/types';

export default function SimulatorPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(false);

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
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Strategy Simulator
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Backtest trading strategies with historical data and analyze performance metrics
          </Typography>
        </Box>

        {/* Strategy Overview (collapsible) */}
        <Box sx={{ mt: 4, mb: 2 }}>
          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent>
              <Typography variant="h5" gutterBottom fontWeight="bold">
                Strategy Overview
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                A daily BTC–ETH momentum strategy with a BTC regime filter and RSI-based entries/exits.
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Button size="small" onClick={() => setShowOverview(v => !v)} sx={{ textTransform: 'none', px: 0 }}>
                  {showOverview ? 'Hide details' : 'Show details'}
                </Button>
              </Box>
              <Collapse in={showOverview} timeout="auto" unmountOnExit>
                <Typography variant="subtitle2" sx={{ color: '#D1D5DB', mb: 1 }}>Core rules</Typography>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Regime filter: Bullish if BTC close &gt; SMA(<b>200</b>) of BTC. In bull we use bullish RSI thresholds; in bear we use bearish thresholds.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Asset eligibility (RSI length <b>8</b>): enter when RSI crosses above entry; exit when RSI crosses below exit.
                      <br />Bull market: entry <b>80</b>, exit <b>65</b>. Bear market: entry <b>65</b>, exit <b>70</b>.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Position sizing: allocate <b>98%</b> of equity to risk assets; 2% remains in cash. If both assets are eligible, split by momentum from the ETH/BTC RSI (length <b>5</b>): ethMomentum = (ETH-BTC-RSI/100 + 0.5)<sup>3.5</sup>, btcMomentum = ((1 − ETH-BTC-RSI/100) + 0.5)<sup>3.5</sup>, then normalize. Ineligible assets get weight 0.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Rebalancing: trade only if |target − current| ≥ <b>27.5%</b> of total equity. Trading fee: <b>0.30%</b> on buys and sells.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Execution & benchmark: trades at daily closes; trading starts the day after the chosen start date. Benchmark buys BTC on day one (net of fee) and holds.
                    </Typography>
                  </li>
                </ul>
                <Typography variant="subtitle2" sx={{ color: '#D1D5DB', mt: 2, mb: 1 }}>Eligibility examples</Typography>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Both eligible: both BTC and ETH RSI‑8 cross above their respective entry thresholds (per regime) → both can be allocated; final split decided by ETH‑BTC‑RSI momentum.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      ETH eligible, BTC not: ETH RSI‑8 crosses above its entry while BTC RSI‑8 does not (or BTC just crossed an exit) → ETH can be allocated; BTC weight is forced to 0.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      BTC eligible, ETH not: BTC RSI‑8 crosses above its entry while ETH RSI‑8 does not (or ETH just crossed an exit) → BTC can be allocated; ETH weight is forced to 0.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Neither eligible: both RSIs are below their entry levels (or recently crossed exits) → both weights 0; remain in cash until a new entry cross.
                    </Typography>
                  </li>
                </ul>
                <Typography variant="subtitle2" sx={{ color: '#D1D5DB', mt: 2, mb: 1 }}>Position sizing examples</Typography>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Both eligible, total equity $10,000, ETH-BTC-RSI=70 → investable = $9,800. ethMomentum ≈ 1.2<sup>3.5</sup>=1.89, btcMomentum ≈ 0.8<sup>3.5</sup>=0.46 → weights ≈ ETH 80.4%, BTC 19.6% → targets ≈ ETH $7,880, BTC $1,920 (subject to 27.5% threshold and fees).
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Only BTC eligible, ETH-BTC-RSI=40 → investable = $9,800. ETH weight = 0, BTC weight = 100% → target BTC $9,800.
                    </Typography>
                  </li>
                </ul>
              </Collapse>
            </CardContent>
          </Card>
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

            {/* RSI & Signals Chart */}
            <RSIAndSignalsChart result={result} />

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