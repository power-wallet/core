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
} from '@mui/material';
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
}

const SimulatorControls: React.FC<SimulatorControlsProps> = ({ onRunSimulation, isLoading }) => {
  const STORAGE_KEY = 'simulator:settings';
  const [strategy, setStrategy] = useState('btc-eth-momentum');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [initialCapital, setInitialCapital] = useState(10000);
  const [error, setError] = useState('');

  // Load saved settings once on mount (client only)
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.strategy) setStrategy(saved.strategy);
        if (saved?.startDate) setStartDate(saved.startDate);
        if (saved?.endDate) setEndDate(saved.endDate);
        if (typeof saved?.initialCapital === 'number') setInitialCapital(saved.initialCapital);
      }
    } catch (_) {
      // ignore
    }
  }, []);

  // Persist settings whenever they change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const payload = { strategy, startDate, endDate, initialCapital };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      // ignore
    }
  }, [strategy, startDate, endDate, initialCapital]);

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
                onChange={(e) => setStrategy(e.target.value)}
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
                <MenuItem value="btc-eth-momentum">BTC-ETH Momentum RSI</MenuItem>
                <MenuItem value="coming-soon" disabled>More strategies coming soon...</MenuItem>
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

            <Grid item xs={12}>
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
                {isLoading ? 'Running Simulation...' : 'Run Simulation'}
              </Button>
              
              {error && (
                <Typography variant="caption" color="error" sx={{ ml: 2 }}>
                  {error}
                </Typography>
              )}
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  );
};

export default SimulatorControls;
