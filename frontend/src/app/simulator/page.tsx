'use client';

import React from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';

export default function Simulator() {
  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Card sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
        <CardContent sx={{ py: 6 }}>
          <Stack spacing={3} alignItems="center">
            <ConstructionIcon sx={{ fontSize: 80, color: 'primary.main' }} />
            <Typography variant="h4" component="h1" fontWeight="bold">
              Strategy Simulator
            </Typography>
            <Typography variant="body1" color="text.secondary">
              The strategy backtesting simulator is coming soon. Here you&apos;ll be able to:
            </Typography>
            <Box component="ul" sx={{ textAlign: 'left', pl: 4 }}>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Test different trading strategies with historical data
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Compare performance metrics across strategies
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Optimize parameters for maximum returns
                </Typography>
              </li>
              <li>
                <Typography variant="body2" color="text.secondary">
                  Analyze risk-adjusted performance
                </Typography>
              </li>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ pt: 2 }}>
              Stay tuned for updates!
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
