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
              From Hackathon to Product
            </Typography>
            <Typography variant="body1" paragraph>
              The Power Wallet project started at the <Box component="a" href="https://ethglobal.com/showcase/power-wallet-8gkxo" target="_blank" rel="noopener noreferrer" sx={{ textDecoration: 'underline', color: 'secondary.main', '&:hover': { color: 'secondary.light' } }}>ETH Global Bangkok Hackathon</Box> in November 2024. <br />
            </Typography>
            <Box component="a" href="https://ethglobal.com/showcase/power-wallet-8gkxo" target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-block', mb: 2, color: 'secondary.main', '&:hover': { color: 'secondary.light' } }}>
              <Box component="img" src="/img/eth-global-hackaton.png" alt="ETH Global Bangkok Hackathon" sx={{ width: '100%', maxWidth: 720, borderRadius: 1, boxShadow: 3 }} />
            </Box>
            <Typography variant="body1" paragraph>
              Over an intense weekend we prototyped a fully on-chain, automated investing experience: seamsless onboarding with Coinbase Smart Wallet, live market data via Chainlink oracles, Uniswap V3 execution on Base, and automated upkeep to keep strategies running 24/7.
            </Typography>
            <Typography variant="body1" paragraph>
              We presented our prototype in front of judges and sponsors, and the response was clear: <br/>
              There’s a real need for simple, secure, self-sovereign solutions for long-term investing in Bitcoin and digital assets. 
              That momentum carried forward, what started as a scrappy prototype is evolving into the product you see today.
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
                  <strong>Smart Contracts:</strong> A secure and transparent suite of carefully crafted smart contracts that power the platform
                </Typography>
              </Box>
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


        <Divider />

        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Power Wallet is currently in development and not yet live. <br />
            You can get a preview of the functionality by connecting to the Base Sepolia testnet. <br />
            Stay tuned for our launch!
          </Typography>
        </Box>
      </Stack>
    </Container>
  );
}
