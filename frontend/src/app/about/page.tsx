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
import TeamCarousel from '@/components/TeamCarousel';

export default function About() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            About Power Wallet
          </Typography>
          <Typography variant="h6" color="text.secondary" paragraph>
            Bitcoin accumulation strategies on autopilot
          </Typography>
        </Box>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom fontWeight="bold">
              Our Mission
            </Typography>
            <Typography variant="body1" paragraph>
              Power Wallet is building on-chain solutions to help you accumulate more Bitcoin over time.
            </Typography>
            <Typography variant="body1" paragraph>
              We provide a suite of automated strategies to DCA into Bitcoin, optimizing exposure and managing risk, so you&apos;ll be a more successful long-term investor.
            </Typography>
            <Typography variant="body1" paragraph>
              By combining blockchain technology, algorithmic execution and risk management, 
              we&apos;re creating a platform where you can invest long-term with security, transparency and peace of mind.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" gutterBottom fontWeight="bold">
              From Hackathon to Product
            </Typography>
            <Typography variant="body1" paragraph>
              The Power Wallet project started at the <Box component="a" href="https://ethglobal.com/showcase/power-wallet-8gkxo" target="_blank" rel="noopener noreferrer" sx={{ textDecoration: 'underline', color: 'secondary.main', '&:hover': { color: 'secondary.light' } }}>ETHGlobal Bangkok</Box> hackathon in November 2024. <br />
            </Typography>
            <Box sx={{ mb: 2 }}>
              <TeamCarousel />
            </Box>
            <Typography variant="body1" paragraph>
              Over an intense weekend we prototyped a fully on-chain, automated Bitcoin investing experience: seamsless onboarding with Coinbase Smart Wallet, 
              live market data via Chainlink oracles, Uniswap V3 execution on Base, and Chainlink Automation to keep the DCA strategies running 24/7.
            </Typography>
            <Typography variant="body1" paragraph>
              We presented our prototype in front of judges and sponsors, and the response reinforced our belief: <br/>
              There’s a real need for simple, secure, self-sovereign solutions for long-term investing in Bitcoin and digital assets. 
              What started as a scrappy prototype is now evolving into a fully featured de-fi protocol.
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
                  1. Create Your Power Wallets
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create your own on-chain wallets, smart contracts owned by you 
                  that hold your digital assets, and execute your favourite rebalancing strategies.
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  2. Deposit USDC
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fund your on-chain wallets with USDC that will be managed by the strategies configured in your wallets.
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  3. Choose an Accumulation Strategy
                </Typography>
                <Typography variant="body2" color="text.secondary" component="div">
                  Select from a growing library of automated Bitcoin accumulation strategies, each designed 
                  to optimize returns and manage risk.
                  Examples include:
                  <Box component="ul" sx={{ listStyleType: 'disc', listStylePosition: 'outside', pl: 3, mt: 2, '& li': { display: 'list-item' } }}>
                    <li><strong>Pure</strong> - The OG accumulator. Buy a fixed amount on a fixed cadence. Best for long‑term believers who are price insensitive and prefer simplicity.</li>
                    <li>
                      <strong>Power</strong> - Optimized BTC accumulation. Scale buys below below &nbsp;
                      <Box component="a" 
                        href="https://charts.bitbo.io/long-term-power-law/" target="_blank" 
                        rel="noopener noreferrer" sx={{ textDecoration: 'underline', color: 'secondary.main', '&:hover': { color: 'secondary.light' } }}>
                          Bitcoin Power Law
                      </Box>
                      &nbsp; model price and trim above. Ideal for mean‑reversion believers seeking efficiency.
                    </li>
                    <li><strong>Smart</strong> - Adaptive DCA that adjusts buys and sells based on volatility and drawdown, with optional rebalancing to a target BTC weight.</li>
                    <li><strong>Trend</strong> - All‑in BTC in confirmed uptrends, gentle DCA in downtrends, boosted buys when well below trend.</li>
                  </Box>
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

        <Box sx={{ textAlign: 'center', pt: 2 }}>
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
