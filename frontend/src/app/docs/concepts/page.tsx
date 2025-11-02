'use client';

import React from 'react';
import { Box, Container, Typography, Card, CardContent, Stack } from '@mui/material';
import DocsTabs from '../DocsTabs';

export default function ConceptsPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '60vh', py: 2 }}>
      <Container maxWidth="lg">
        <DocsTabs />

        <Box sx={{ mb: 3 }}>
          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={1.25}>
                <Typography variant="subtitle1" fontWeight="bold">What is a Power Wallet?</Typography>
                <Typography variant="body2" color="text.secondary">
                  A Power Wallet is a digital vault on the Base blockchain that holds USDC and BTC in the form of Coinbase&apos;s wrapped Bitcoin (cbBTC).
                  Each wallet is controlled by its owner&rsquo;s address and linked to a strategy contract that automates rebalancing of assets.
                </Typography>

                <Typography variant="subtitle1" fontWeight="bold">Ownership and control</Typography>
                <Typography variant="body2" color="text.secondary">
                  You are the sole owner of both the wallet and strategy instances. No one can move funds without your signature.
                  You can deposit, withdraw, pause automation, update parameters, or close the wallet at any time.
                </Typography>

                <Typography variant="subtitle1" fontWeight="bold">Strategies</Typography>
                <Typography variant="body2" color="text.secondary">
                  Strategies define the rules, encoded as smart contracts, for dollar‑cost averaging and rebalancing.
                  Available strategies include Pure (classic DCA), Power (adaptive buys and sells with bitcoin&apos;s power-law price model),
                  Smart (adaptive buys with volatility/drawdown kicker and optional rebalancing), and Trend (DCA in downtrends and goes all‑in in uptrends).
                  You control the strategy and can tweak the parameters as needed.
                </Typography>

                <Typography variant="subtitle1" fontWeight="bold">Automation</Typography>
                <Typography variant="body2" color="text.secondary">
                  Chainlink Automation calls strategy functions on a schedule, e.g., executing DCA, computing indicators, or rebalancing pools.
                  You can pause/unpause automation per wallet. Failed upkeeps are retried; actions still require parameters you set.
                </Typography>

                <Typography variant="subtitle1" fontWeight="bold">Pricing and valuation</Typography>
                <Typography variant="body2" color="text.secondary">
                  Chainlink price feeds for BTC, ETH and USDC are used to ensure swaps are executed at the correct price.
                </Typography>

                <Typography variant="subtitle1" fontWeight="bold">Safety</Typography>
                <Typography variant="body2" color="text.secondary">
                  Contracts are open source and verified on‑chain. You control the wallet and strategy instances.
                  All assets remain in your Power Wallet; strategies do not custody assets. Always verify chain, addresses, and transactions.
                  Market, oracle, and smart contract risks apply.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}


