'use client';

import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, Alert, AlertTitle, Card, CardContent, Collapse, Button, IconButton } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SimulatorControls, { type SimulationParams } from '@/components/simulator/SimulatorControls';
import StatsSummary from '@/components/simulator/StatsSummary';
import StrategyCharts from '@/components/simulator/StrategyCharts';
import { runStrategy } from '@/lib/simulator';
import { loadPriceData } from '@/lib/priceFeed';
import type { SimulationResult } from '@/lib/types';

export default function SimulatorPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(false);
  const [strategyId, setStrategyId] = useState<string>('smart-btc-dca');

  // Load saved strategy on mount
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('simulator:settings') : null;
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.strategy) setStrategyId(saved.strategy);
      }
    } catch {}
  }, []);

  // Clear previous result when switching strategy so Overview reflects selection
  useEffect(() => {
    setResult(null);
  }, [strategyId]);

  const handleRunSimulation = async (params: SimulationParams) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const prices = await loadPriceData(params.startDate, params.endDate, 210);
      const simulationResult = await runStrategy(
        params.strategy as any,
        params.initialCapital,
        params.startDate,
        params.endDate,
        prices
      );
      setResult(simulationResult);
    } catch (err) {
      console.error('Simulation error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during simulation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPerformance = () => {
    if (!result) return;
    const dp = [...result.dailyPerformance].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const rsi = result.rsiSignals || [];
    const trades = result.trades || [];

    const header = [
      // DailyPerformance
      'Date','cash','btcQty','ethQty','btcValue','ethValue','totalValue','btcHodlValue','drawdown','btcHodlDrawdown','btcPrice','ethPrice','btcModel','btcUpperBand','btcLowerBand',
      // DailyRsiSignals
      'btcRsi','ethRsi','entryLine','exitLine','btcBuy','btcSell','ethBuy','ethSell','bothEligible','bothAllocated','btcBuyDetail','btcSellDetail','ethBuyDetail','ethSellDetail',
      // Trade (if any on that date)
      'trade.symbol','trade.side','trade.price','trade.quantity','trade.value','trade.fee','trade.portfolioValue',
    ];

    const byDateTrades = trades.reduce<Record<string, typeof trades>>((m, t) => {
      (m[t.date] ||= []).push(t);
      return m;
    }, {});

    const rsiByDate = rsi.reduce<Record<string, any>>((m, s) => { m[s.date] = s; return m; }, {});

    const lines: string[] = [];
    lines.push(header.join('\t'));

    for (const d of dp) {
      const r = rsiByDate[d.date];
      const ts = byDateTrades[d.date] || [];
      if (ts.length === 0) {
        const row = [
          new Date(d.date).toLocaleDateString('en-CA'), String(d.cash), String(d.btcQty), String(d.ethQty), String(d.btcValue), String(d.ethValue), String(d.totalValue), String(d.btcHodlValue), String(d.drawdown), String(d.btcHodlDrawdown), String(d.btcPrice), String(d.ethPrice),
          d.btcModel != null ? String(d.btcModel) : '', d.btcUpperBand != null ? String(d.btcUpperBand) : '', d.btcLowerBand != null ? String(d.btcLowerBand) : '',
          r ? String(r.btcRsi) : '', r ? String(r.ethRsi) : '', r ? String(r.entryLine) : '', r ? String(r.exitLine) : '', r ? String(r.btcBuy) : '', r ? String(r.btcSell) : '', r ? String(r.ethBuy) : '', r ? String(r.ethSell) : '', r ? String(r.bothEligible) : '', r ? String(r.bothAllocated) : '', r?.btcBuyDetail || '', r?.btcSellDetail || '', r?.ethBuyDetail || '', r?.ethSellDetail || '',
          '', '', '', '', '', '', '',
        ];
        lines.push(row.join('\t'));
      } else {
        for (const t of ts) {
          const row = [
            new Date(d.date).toLocaleDateString('en-CA'), String(d.cash), String(d.btcQty), String(d.ethQty), String(d.btcValue), String(d.ethValue), String(d.totalValue), String(d.btcHodlValue), String(d.drawdown), String(d.btcHodlDrawdown), String(d.btcPrice), String(d.ethPrice),
            d.btcModel != null ? String(d.btcModel) : '', d.btcUpperBand != null ? String(d.btcUpperBand) : '', d.btcLowerBand != null ? String(d.btcLowerBand) : '',
            r ? String(r.btcRsi) : '', r ? String(r.ethRsi) : '', r ? String(r.entryLine) : '', r ? String(r.exitLine) : '', r ? String(r.btcBuy) : '', r ? String(r.btcSell) : '', r ? String(r.ethBuy) : '', r ? String(r.ethSell) : '', r ? String(r.bothEligible) : '', r ? String(r.bothAllocated) : '', r?.btcBuyDetail || '', r?.btcSellDetail || '', r?.ethBuyDetail || '', r?.ethSellDetail || '',
            t.symbol, t.side, t.price.toFixed(0), t.quantity.toFixed(6), t.value.toFixed(0), t.fee.toFixed(2), t.portfolioValue.toFixed(0),
          ];
          lines.push(row.join('\t'));
        }
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'performance.tsv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

        {/* Strategy selection first */}
        <SimulatorControls onRunSimulation={handleRunSimulation} isLoading={isLoading} strategy={strategyId} onStrategyChange={(id) => setStrategyId(id)} />

        {/* Strategy Overview (collapsible) */}
        <Box sx={{ mt: 2, mb: 2 }}>
          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent>
              <Typography variant="h5" gutterBottom fontWeight="bold">
                Strategy Overview
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {(() => {
                  const id = strategyId;
                  if (id === 'smart-btc-dca') {
                    return 'A BTC-only DCA strategy guided by a Power Law model, with dynamic buy/sell rules around lower/model/upper bands.';
                  }
                  if (id === 'power-btc-dca') {
                    return 'An adaptive BTC DCA that scales buys with volatility and drawdowns, with optional threshold rebalancing to a target BTC weight band.';
                  }
                  if (id === 'simple-btc-dca') {
                    return 'A simple BTC DCA that invests a fixed USDC amount on a weekly schedule until cash is exhausted.';
                  }
                  if (id === 'btc-eth-momentum') {
                    return 'A daily BTC–ETH momentum strategy with a BTC regime filter and RSI-based entries/exits.';
                  }
                  if (id === 'btc-trend-following') {
                    return 'A weekly 50‑day SMA trend strategy: fully in BTC when price > 50D SMA; otherwise in USDC.';
                  }
                  return '';
                })()}
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Button size="small" onClick={() => setShowOverview(v => !v)} sx={{ textTransform: 'none', px: 0 }}>
                  {showOverview ? 'Hide details' : 'Show details'}
                </Button>
              </Box>
              <Collapse in={showOverview} timeout="auto" unmountOnExit>
                {(() => {
                  const id = strategyId;
                  if (id === 'smart-btc-dca') {
                    return (
                      <>
                        <Typography variant="subtitle2" sx={{ color: '#D1D5DB', mb: 1 }}>Core rules</Typography>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Power law model defines a fair-value curve P(t) with two bands: lower = 0.5×model, upper = 2×model.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Below lower band: buy 5% of available USDC (weekly cadence, 0.30% fee).
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Between lower and model: buy 1% of available USDC.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Between model and upper: no action.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Above upper band: sell 5% of BTC holdings.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Reserves: keep ~2% in USDC and ~10% in BTC (min holdings logic in simulator).
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Execution & benchmark: trades at daily closes on a weekly schedule; benchmark buys BTC on day one (net of fee) and holds.
                            </Typography>
                          </li>
                        </ul>
                      </>
                    );
                  }
                  if (id === 'power-btc-dca') {
                    return (
                      <>
                        <Typography variant="subtitle2" sx={{ color: '#D1D5DB', mb: 1 }}>Core rules</Typography>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Base DCA: buy a fixed USDC amount daily (default $50); keep a USDC buffer (default 9× base DCA).
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Volatility kicker: add extra buy scaled by annualized volatility and current drawdown, capped at 3× base DCA.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Optional threshold rebalancing: if BTC weight is above the upper band → SELL to band; below the lower band → BUY to band (each capped to 25% of NAV per trade).
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Target weight band: center 70% BTC with ±10% band (i.e., 60%–80%).
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Fees: trades assume a 0.30% fee; benchmark buys BTC on day one (net of fee) and holds.
                            </Typography>
                          </li>
                        </ul>
                        <Typography variant="subtitle2" sx={{ color: '#D1D5DB', mt: 2, mb: 1 }}>Examples</Typography>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Nav $10,000, BTC −30% from peak, high vol: base $50 + kicker (capped to $150) → total buy ≈ $200 if buffer allows.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Nav $12,000, BTC weight 85% (above band): threshold mode sells down to 80% with a single trade capped at 25% of NAV.
                            </Typography>
                          </li>
                        </ul>
                      </>
                    );
                  }
                  if (id === 'simple-btc-dca') {
                    return (
                      <>
                        <Typography variant="subtitle2" sx={{ color: '#D1D5DB', mb: 1 }}>Core rules</Typography>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Fixed DCA: invest $100 USDC in BTC every 7 days until USDC is exhausted.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              No sells; the strategy accumulates BTC over time.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Fees: 0.30% applied to each buy to approximate trading costs.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Execution & benchmark: trades at daily closes on a weekly schedule; benchmark buys BTC on day one (net of fee) and holds.
                            </Typography>
                          </li>
                        </ul>
                      </>
                    );
                  }
                  if (id === 'btc-eth-momentum') {
                    return (
                      <>
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
                      </>
                    );
                  }
                  if (id === 'btc-trend-following') {
                    return (
                      <>
                        <Typography variant="subtitle2" sx={{ color: '#D1D5DB', mb: 1 }}>Core rules</Typography>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Signal: BTC close versus its 50‑day simple moving average (SMA50).
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Entry (weekly): close &gt; SMA50 × 1.005 AND RSI(14) &gt; 60 AND SMA50 rising over 5 days.
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Exit (aggressive): close &lt; SMA50 → SELL 100% to USDC (after 0.30% fee).
                            </Typography>
                          </li>
                          <li>
                            <Typography variant="body2" color="text.secondary">
                              Evaluation cadence: every 7 days; decisions only occur on evaluation dates.
                            </Typography>
                          </li>
                        </ul>
                      </>
                    );
                  }
                  return null;
                })()}
              </Collapse>
            </CardContent>
          </Card>
        </Box>

        

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

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h5" fontWeight="bold">Performance Charts</Typography>
              <IconButton onClick={handleDownloadPerformance} aria-label="Download performance TSV" size="small">
                <DownloadIcon />
              </IconButton>
            </Box>

            {/* Charts */}
            <StrategyCharts result={result} />
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