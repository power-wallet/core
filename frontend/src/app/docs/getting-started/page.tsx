'use client';

import React from 'react';
import { Box, Container, Typography, Card, CardContent, Stack, Divider } from '@mui/material';
import DocsTabs from '../DocsTabs';

export default function GettingStartedPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '60vh', py: 2 }}>
      <Container maxWidth="lg">
        <DocsTabs />

        <Box sx={{ mb: 3 }}>
          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold">Beta testing &amp; early access</Typography>
              
              <Typography variant="body2" gutterBottom sx={{ mb: 2, mt: 1 }}>
                Power Wallet is currently available to be <strong>beta tested</strong> on the <strong>Base Sepolia testnet</strong>.
                <br />
                We invite you to help us test the platform and provide feedback.
              </Typography>
              <Typography variant="body2" gutterBottom sx={{ mb: 4 }}>
                We are also starting a <strong>closed access program</strong> on the <strong>Base mainnet</strong> with a limited number of users.
                <br />
                If you are interested in being part of the closed access program, please contact us via Telegram.
              </Typography>

              <Divider />

              <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 4, mb: 2 }}>To get started</Typography>

            <Typography variant="body2">
                Follow the steps in the video to create your first Power Wallet on the Base testnet, claim testnet USDC
                and start your first bitcoin accumulation strategy today.
            </Typography>

              <Box sx={{ mt: 4 }}>
                <div style={{ position: 'relative', paddingBottom: '64.86161251504213%', height: 0 }}>
                  <iframe src="https://www.loom.com/embed/8e02300b548f45a3b5c73cfe66eac2bd" 
                       frameBorder="0" allowFullScreen
                       style={{ position: 'absolute', top: 0, left: 0, width: '80%', height: '100%' }}>
                     </iframe>
                </div>
              </Box>

              <Stack spacing={1.25} sx={{ mt: 4 }}>
                <Typography variant="body2">
                  1. Connect a wallet on Base Sepolia testnet. Fund USDC using the build-in faucet.
                </Typography>
                <Typography variant="body2">
                  2. Create a Power Wallet and pick a strategy (Pure, Power, Smart, or Trend).
                </Typography>
                <Typography variant="body2">
                  3. Deposit USDC. Automation will execute the strategy on schedule. You can pause automation or withdraw anytime.
                </Typography>
                <Typography variant="body2">
                  4. Track performance in My Wallet → Wallet History.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}


