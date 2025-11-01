'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Typography,
  MenuItem,
  CircularProgress,
  Collapse,
  IconButton,
  Divider,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { loadStrategy, loadStrategyMeta } from '@/lib/strategies/registry';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface SimulatorControlsProps {
  onRunSimulation: (params: SimulationParams) => void;
  isLoading: boolean;
}

export interface SimulationParams {
  strategy: string;
  startDate: string;
  endDate: string;
  depositAmount: number;
  depositIntervalDays: number;
  options?: Record<string, any>;
}

const SimulatorControls: React.FC<SimulatorControlsProps & { strategy: string; onStrategyChange: (id: string) => void }> = ({ onRunSimulation, isLoading, strategy, onStrategyChange }) => {
  const STORAGE_KEY = 'simulator:settings';
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [depositAmount, setDepositAmount] = useState(1000);
  const [depositIntervalDays, setDepositIntervalDays] = useState(30);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [strategyOptions, setStrategyOptions] = useState<Record<string, any>>({});
  const [strategyParamMeta, setStrategyParamMeta] = useState<Record<string, any> | null>(null);

  // Load saved settings once on mount (client only)
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.startDate) setStartDate(saved.startDate);
        if (saved?.endDate) setEndDate(saved.endDate);
        // Back-compat: map previous initialCapital to depositAmount if present
        if (typeof saved?.depositAmount === 'number') setDepositAmount(saved.depositAmount);
        else if (typeof saved?.initialCapital === 'number') setDepositAmount(saved.initialCapital);
        if (typeof saved?.depositIntervalDays === 'number') setDepositIntervalDays(saved.depositIntervalDays);
        if (saved?.options && typeof saved.options === 'object') setStrategyOptions(saved.options);
      }
    } catch (_) {
      // ignore
    }
  }, []);

  // Persist settings whenever they change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const payload = { strategy, startDate, endDate, depositAmount, depositIntervalDays, options: strategyOptions };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      // ignore
    }
  }, [strategy, startDate, endDate, depositAmount, depositIntervalDays, strategyOptions]);
  // Ensure options object has an entry for the selected strategy with defaults
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const strat = await loadStrategy(strategy as any);
        const defaults = strat.getDefaultParameters();
        if (cancelled) return;
        setStrategyOptions(prev => {
          if (prev && prev[strategy]) return prev;
          return { ...prev, [strategy]: defaults };
        });
         // Load parameter metadata via registry helper
        const meta = await loadStrategyMeta(strategy as any);
        if (!cancelled) setStrategyParamMeta(meta ?? null);
      } catch (_) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [strategy]);

  // Validate dates
  useEffect(() => {
    if (startDate && endDate && startDate >= endDate) {
      setError('End date must be after start date');
    } else {
      setError('');
    }
  }, [startDate, endDate]);

  const { numDeposits, totalInvested } = useMemo(() => {
    const fmt = (d: string) => (d ? new Date(d + 'T00:00:00Z') : null);
    const s = fmt(startDate);
    const e = fmt(endDate);
    if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) {
      return { numDeposits: 0, totalInvested: 0 };
    }
    if (!(depositAmount > 0)) {
      return { numDeposits: 0, totalInvested: 0 };
    }
    if (depositIntervalDays <= 0) {
      return { numDeposits: 1, totalInvested: depositAmount };
    }
    let n = 0;
    const d = new Date(s.getTime());
    while (d <= e) {
      n += 1;
      d.setDate(d.getDate() + depositIntervalDays);
    }
    return { numDeposits: n, totalInvested: n * depositAmount };
  }, [startDate, endDate, depositAmount, depositIntervalDays]);

  const handleResetOptions = async () => {
    try {
      const strat = await loadStrategy(strategy as any);
      const defaults = strat.getDefaultParameters();
      setStrategyOptions((prev) => ({ ...prev, [strategy]: defaults }));
    } catch (_) {
      // ignore
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (error) return;
    
    if (depositAmount < 10) {
      setError('Deposit amount must be at least $10');
      return;
    }
    
    onRunSimulation({
      strategy,
      startDate,
      endDate,
      depositAmount,
      depositIntervalDays,
      options: strategyOptions,
    });
  };

  return (
    <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D', mb: 4 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
          Simulation Configuration
        </Typography>
        
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="Strategy"
                value={strategy}
                onChange={(e) => onStrategyChange(e.target.value)}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: '#2D2D2D' },
                    '&:hover fieldset': { borderColor: '#F59E0B' },
                    '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                  },
                  '& .MuiInputLabel-root': { color: '#D1D5DB' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#F59E0B' },
                }}
              >
                <MenuItem value="simple-btc-dca">Pure - Classic DCA</MenuItem>
                <MenuItem value="smart-btc-dca">Smart - Buy the Dip & DCA</MenuItem>
                <MenuItem value="power-btc-dca">Power - Fair Value DCA</MenuItem>
                <MenuItem value="trend-btc-dca">Trend - Trend Aligned DCA</MenuItem>
                <MenuItem value="btc-eth-momentum">Momentum - BTC-ETH Swing</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Start Date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: '#2D2D2D' },
                    '&:hover fieldset': { borderColor: '#F59E0B' },
                    '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                  },
                  '& .MuiInputLabel-root': { color: '#D1D5DB' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#F59E0B' },
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="date"
                label="End Date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: '#2D2D2D' },
                    '&:hover fieldset': { borderColor: '#F59E0B' },
                    '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                  },
                  '& .MuiInputLabel-root': { color: '#D1D5DB' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#F59E0B' },
                }}
              />
            </Grid>

            {/* Desktop spacer to start deposits on next row */}
            <Grid item xs={12} md={3} sx={{ display: { xs: 'none', md: 'block' } }} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Deposit Amount (USD)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                variant="outlined"
                inputProps={{ min: 10, step: 10 }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: '#2D2D2D' },
                    '&:hover fieldset': { borderColor: '#F59E0B' },
                    '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                  },
                  '& .MuiInputLabel-root': { color: '#D1D5DB' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#F59E0B' },
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                select
                fullWidth
                label="Deposit Cadence"
                value={String(depositIntervalDays)}
                onChange={(e) => setDepositIntervalDays(Number(e.target.value))}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    '& fieldset': { borderColor: '#2D2D2D' },
                    '&:hover fieldset': { borderColor: '#F59E0B' },
                    '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                  },
                  '& .MuiInputLabel-root': { color: '#D1D5DB' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#F59E0B' },
                }}
              >
                <MenuItem value="0">One-off</MenuItem>
                <MenuItem value="1">Daily</MenuItem>
                <MenuItem value="7">Weekly</MenuItem>
                <MenuItem value="14">Biweekly</MenuItem>
                <MenuItem value="30">Monthly</MenuItem>
              </TextField>
            </Grid>

            {/* Live total investment preview */}
            <Grid item xs={12}>
              {numDeposits > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Total invested: ${totalInvested.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  {depositIntervalDays <= 0 ? ' (one-off)' : ` across ${numDeposits} deposit${numDeposits === 1 ? '' : 's'}`}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isLoading || !!error}
                startIcon={isLoading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                sx={{
                  background: 'linear-gradient(45deg, #F59E0B 30%, #FB923C 90%)',
                  boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.39)',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
                  },
                  '&:disabled': {
                    background: '#2D2D2D',
                    color: '#666',
                  },
                }}
              >
                {isLoading ? 'Running Simulation...' : 'Simulate'}
              </Button>

              <Button
                type="button"
                variant="outlined"
                size="medium"
                onClick={() => setShowAdvanced(v => !v)}
                startIcon={<TuneIcon />}
                endIcon={<ExpandMoreIcon sx={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                sx={{ borderColor: '#2D2D2D', color: '#D1D5DB', textTransform: 'none' }}
              >
                Options
              </Button>
              
              {error && (
                <Typography variant="caption" color="error" sx={{ ml: 2 }}>
                  {error}
                </Typography>
              )}
            </Grid>
          </Grid>
        </form>

        <Collapse in={showAdvanced} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 2, borderColor: '#2D2D2D' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ color: '#D1D5DB' }}>Options</Typography>
            <Button size="small" onClick={handleResetOptions} sx={{ textTransform: 'none', color: '#F59E0B', '&:hover': { color: '#FDBA74' } }}>
              Reset
            </Button>
          </Box>
          {(() => {
            const meta = strategyParamMeta ?? {};
            const current = strategyOptions?.[strategy] ?? {};

            const handleField = (key: string, val: any) => {
              setStrategyOptions((prev) => ({ ...prev, [strategy]: { ...(prev?.[strategy] ?? {}), [key]: val } }));
            };

            const keys = Object.keys(meta).filter((k) => meta[k]?.configurable);
            if (keys.length === 0) return (
              <Typography variant="body2" color="text.secondary">No configurable options.</Typography>
            );

            return (
              <Grid container spacing={2}>
                {keys.map((key) => {
                  const m = meta[key];
                  const type = m?.type as string;
                  const name = m?.name || key;
                  const description = m?.description || '';
                  const defaultVal = m?.defaultValue;
                  const value = current[key] != null ? current[key] : defaultVal;

                  if (type === 'boolean') {
                    return (
                      <Grid item xs={12} sm={6} md={4} key={key}>
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                          {description}
                        </Typography>
                        <TextField
                          select
                          fullWidth
                          label={name}
                          value={String(Boolean(value))}
                          onChange={(e) => handleField(key, e.target.value === 'true')}
                          variant="outlined"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: 'white',
                              '& fieldset': { borderColor: '#2D2D2D' },
                              '&:hover fieldset': { borderColor: '#F59E0B' },
                              '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                            },
                            '& .MuiInputLabel-root': { color: '#D1D5DB' },
                            '& .MuiInputLabel-root.Mui-focused': { color: '#F59E0B' },
                          }}
                        >
                          <MenuItem value="true">True</MenuItem>
                          <MenuItem value="false">False</MenuItem>
                        </TextField>
                      </Grid>
                    );
                  }

                  if (type === 'percentage') {
                    const minPerc: number = Number(m?.minPerc ?? 0);
                    const maxPerc: number = Number(m?.maxPerc ?? 100);
                    const percInc: number = Number(m?.percInc ?? 1);
                    const decimals = Math.max(0, ((String(percInc).split('.')[1]) || '').length);
                    const options: number[] = [];
                    for (let p = minPerc; p <= maxPerc + 1e-9; p = Number((p + percInc).toFixed(decimals))) {
                      options.push(Number(p.toFixed(decimals)));
                    }
                    const pctValue = (Number(value) || 0) * 100;
                    const pctStr = pctValue.toFixed(decimals);
                    return (
                      <Grid item xs={12} sm={6} md={4} key={key}>
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                          {description}
                        </Typography>
                        <TextField
                          select
                          fullWidth
                          label={name}
                          value={pctStr}
                          onChange={(e) => handleField(key, Number(e.target.value) / 100)}
                          variant="outlined"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              color: 'white',
                              '& fieldset': { borderColor: '#2D2D2D' },
                              '&:hover fieldset': { borderColor: '#F59E0B' },
                              '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                            },
                            '& .MuiInputLabel-root': { color: '#D1D5DB' },
                            '& .MuiInputLabel-root.Mui-focused': { color: '#F59E0B' },
                          }}
                        >
                          {options.map((p) => (
                            <MenuItem key={p.toFixed(decimals)} value={p.toFixed(decimals)}>{p.toFixed(decimals)}%</MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                    );
                  }

                  // days or number -> numeric input
                  return (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        {description}
                      </Typography>
                      <TextField
                        fullWidth
                        type="number"
                        label={name}
                        value={Number(value)}
                        onChange={(e) => handleField(key, Number(e.target.value))}
                        variant="outlined"
                        inputProps={{ min: 0, step: type === 'number' ? 1 : 1 }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            color: 'white',
                            '& fieldset': { borderColor: '#2D2D2D' },
                            '&:hover fieldset': { borderColor: '#F59E0B' },
                            '&.Mui-focused fieldset': { borderColor: '#F59E0B' },
                          },
                          '& .MuiInputLabel-root': { color: '#D1D5DB' },
                          '& .MuiInputLabel-root.Mui-focused': { color: '#F59E0B' },
                        }}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            );
          })()}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default SimulatorControls;
