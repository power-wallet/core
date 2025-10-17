'use client';

import React, { useState, useEffect } from 'react';
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
import { loadStrategy } from '@/lib/strategies/registry';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface SimulatorControlsProps {
  onRunSimulation: (params: SimulationParams) => void;
  isLoading: boolean;
}

export interface SimulationParams {
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  options?: Record<string, any>;
}

const SimulatorControls: React.FC<SimulatorControlsProps & { strategy: string; onStrategyChange: (id: string) => void }> = ({ onRunSimulation, isLoading, strategy, onStrategyChange }) => {
  const STORAGE_KEY = 'simulator:settings';
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [initialCapital, setInitialCapital] = useState(10000);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [strategyOptions, setStrategyOptions] = useState<Record<string, any>>({});

  // Load saved settings once on mount (client only)
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.startDate) setStartDate(saved.startDate);
        if (saved?.endDate) setEndDate(saved.endDate);
        if (typeof saved?.initialCapital === 'number') setInitialCapital(saved.initialCapital);
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
      const payload = { strategy, startDate, endDate, initialCapital, options: strategyOptions };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      // ignore
    }
  }, [strategy, startDate, endDate, initialCapital, strategyOptions]);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (error) return;
    
    if (initialCapital < 100) {
      setError('Initial capital must be at least $100');
      return;
    }
    
    onRunSimulation({
      strategy,
      startDate,
      endDate,
      initialCapital,
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
                <MenuItem value="simple-btc-dca">Simple (Basic DCA)</MenuItem>
                <MenuItem value="smart-btc-dca">Smart (Buy the Dip)</MenuItem>
                <MenuItem value="power-btc-dca">Power (Mean Reversion Twist)</MenuItem>
                <MenuItem value="trend-btc-dca">Trend (Trend Following)</MenuItem>
                <MenuItem value="btc-eth-momentum">Momentun (BTC-ETH Strategy)</MenuItem>
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

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="number"
                label="Initial Capital (USD)"
                value={initialCapital}
                onChange={(e) => setInitialCapital(Number(e.target.value))}
                variant="outlined"
                inputProps={{ min: 100, step: 100 }}
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
          <Typography variant="subtitle1" sx={{ color: '#D1D5DB', mb: 2 }}>Options</Typography>
          {(() => {
            const defaults: Record<string, any> = strategyOptions?.[strategy] ?? {};
            const current = strategyOptions?.[strategy] ?? defaults;

            const labelize = (k: string) => k
              .replace(/([a-z])([A-Z])/g, '$1 $2')
              .replace(/^\w/, c => c.toUpperCase());

            const handleField = (key: string, val: any) => {
              setStrategyOptions((prev) => ({ ...prev, [strategy]: { ...(prev?.[strategy] ?? {}), [key]: val } }));
            };

            return (
              <Grid container spacing={2}>
                {Object.entries(defaults).map(([key, val]) => (
                  <Grid item xs={12} sm={6} md={4} key={key}>
                    {typeof val === 'boolean' ? (
                      <TextField
                        select
                        fullWidth
                        label={labelize(key)}
                        value={String(current[key] ?? val)}
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
                    ) : (
                      <TextField
                        fullWidth
                        type="number"
                        label={labelize(key)}
                        value={Number(current[key] ?? val)}
                        onChange={(e) => handleField(key, Number(e.target.value))}
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
                    )}
                  </Grid>
                ))}
              </Grid>
            );
          })()}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default SimulatorControls;
