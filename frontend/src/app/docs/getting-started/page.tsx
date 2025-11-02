'use client';

import React from 'react';
import { Box, Container, Typography, Card, CardContent, Stack } from '@mui/material';
import DocsTabs from '../DocsTabs';

export default function GettingStartedPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '60vh', py: 2 }}>
      <Container maxWidth="lg">
        <DocsTabs />

        <Box sx={{ mb: 3 }}>
          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={1.25}>
                <Typography variant="body2">
                  1) Connect a wallet on Base or Base Sepolia. Fund USDC if you plan to deposit.
                </Typography>
                <Typography variant="body2">
                  2) Create a Power Wallet and pick a strategy (Pure, Power, Smart, or Trend). You own the wallet and the strategy instance.
                </Typography>
                <Typography variant="body2">
                  3) Deposit USDC. Automation will execute the strategy on schedule. You can pause automation or withdraw anytime.
                </Typography>
                <Typography variant="body2">
                  4) Track performance in My Wallet → Wallet History. Switch between Value and Assets views, and export data as needed.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}


