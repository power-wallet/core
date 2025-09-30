'use client';

import React from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Divider,
} from '@mui/material';

export default function About() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            About Power Wallet
          </Typography>
          <Typography variant="h6" color="text.secondary" paragraph>
            The Future of Smart, On-Chain Investing
          </Typography>
        </Box>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom fontWeight="bold">
              Our Mission
            </Typography>
            <Typography variant="body1" paragraph>
              Power Wallet is building the next generation of on-chain investment tools. 
              We believe that everyone should have access to sophisticated trading strategies 
              that were previously only available to institutional investors.
            </Typography>
            <Typography variant="body1" paragraph>
              By combining blockchain technology with algorithmic trading, we&apos;re creating 
              a platform where users can deploy capital into automated strategies with complete 
              transparency and security.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom fontWeight="bold">
              How It Works
            </Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  1. Create Your Wallet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Connect an existing Web3 wallet or create a new Coinbase Smart Wallet 
                  in seconds - no extensions or recovery phrases needed.
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  2. Deposit USDC
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fund your on-chain wallet with USDC stablecoins. Your funds remain 
                  under your control at all times.
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  3. Choose a Strategy
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select from our library of automated trading strategies, each designed 
                  to optimize returns based on technical indicators and market conditions.
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  4. Track Performance
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monitor your portfolio performance in real-time. All transactions are 
                  transparent and verifiable on-chain.
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom fontWeight="bold">
              Technology Stack
            </Typography>
            <Typography variant="body1" paragraph>
              Power Wallet is built on cutting-edge blockchain technology:
            </Typography>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="body2">
                  <strong>Base Network:</strong> Low-cost, high-speed Layer 2 blockchain for efficient transactions
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2">
                  <strong>Chainlink Oracles:</strong> Reliable, decentralized price feeds for accurate market data
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2">
                  <strong>Smart Contracts:</strong> Audited, upgradeable contracts for strategy execution
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2">
                  <strong>Coinbase Smart Wallet:</strong> Easy onboarding with passkey authentication
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Divider />

        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Power Wallet is currently in development. Stay tuned for our launch!
          </Typography>
        </Box>
      </Stack>
    </Container>
  );
}
