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
              We believe that everyone should have access to long term bitcoin and crypto investment strategies 
              that combine high returns with built-in risk management.
            </Typography>
            <Typography variant="body1" paragraph>
              By combining blockchain technology, portfolio management, algorithmic trading 
              and risk management, we&apos;re creating a platform where users can invest long 
              term with security, transparency and peace of mind.
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
                  Select from our library of automated investment strategies, each designed 
                  to optimize returns and manage risk.
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
                  <strong>Uniswap V3:</strong> Permissionless, decentralized exchange with deep liquidity
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2">
                  <strong>Chainlink Oracles:</strong> Reliable, decentralized price feeds for accurate market data
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2">
                  <strong>Chainlink Automation:</strong> Automated execution of strategies with real-time market data
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2">
                  <strong>Coinbase Smart Wallet:</strong> Easy onboarding with passkey authentication and easy on-ramp
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom fontWeight="bold">
              Our Smart Contracts
            </Typography>
            <Typography variant="body1" paragraph>
              Power Wallet smart contracts power our on-chain data and automation. <br />
              We currently have the
              <strong> TechnicalIndicators</strong> contract deployed on <strong>Base Sepolia</strong> at
              {' '}<a
                href="https://sepolia.basescan.org/address/0x7A0F3B371A2563627EfE1967E7645812909Eb6c5"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#60A5FA', textDecoration: 'none' }}
              >
                0x7A0F3B371A2563627EfE1967E7645812909Eb6c5
              </a>.
            </Typography>
            <Typography variant="body1" paragraph>
              We use <strong>Chainlink Automation</strong> to keep our price feeds and technical indicators (e.g.,
              SMA and RSI) updated on-chain. You can view our upkeep here:
              {' '}<a
                href="https://automation.chain.link/base-sepolia/8004073430779205612692946193676807911407093530369256047496210613749968071145"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#60A5FA', textDecoration: 'none' }}
              >
                Chainlink Automation Upkeep (Base Sepolia)
              </a>.
            </Typography>
            <Typography variant="body1" paragraph>
              We rely on <strong>Chainlink Price Feeds</strong> on Base Sepolia for on-chain pricing:
              <br />
              • BTC/USD price feed:
              {' '}<a
                href="https://sepolia.basescan.org/address/0xcbB7C0006F23900c38EB856149F799620fcb8A4a"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#60A5FA', textDecoration: 'none' }}
              >
                0xcbB7C0006F23900c38EB856149F799620fcb8A4a
              </a>
              <br />
              • ETH/USD price feed:
              {' '}<a
                href="https://sepolia.basescan.org/address/0x4200000000000000000000000000000000000006"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#60A5FA', textDecoration: 'none' }}
              >
                0x4200000000000000000000000000000000000006
              </a>
            </Typography>
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
