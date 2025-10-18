'use client';

import React from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import Link from 'next/link';

export default function Home() {
  // Avoid runtime media queries for typography to prevent hydration flicker.

  const features = [
    {
      icon: <AccountBalanceWalletIcon sx={{ fontSize: 48 }} />,
      title: 'On-Chain Wallets',
      description: 'Create multiple smart wallets directly on the blockchain. Your wallets, your funds, your control.',
    },
    {
      icon: <AutoGraphIcon sx={{ fontSize: 48 }} />,
      title: 'Automated Strategies',
      description: 'Deploy proven, long-term investment strategies that manage your assets for you 24/7.',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 48 }} />,
      title: 'Secure & Transparent',
      description: 'All transactions happen on-chain. Fully auditable, secure, and transparent.',
    },
    {
      icon: <TrendingUpIcon sx={{ fontSize: 48 }} />,
      title: 'Smart Investing',
      description: 'Optimize your Bitcoin and digital asset returns, manage risk so you can enjoy a peace of mind.',
    },
  ];

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '60vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1A1A1A 0%, #2D1B0E 50%, #1A1A1A 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 30% 50%, rgba(245, 158, 11, 0.15) 0%, transparent 50%)',
            pointerEvents: 'none',
          },
          color: 'white',
          pt: { xs: 8, md: 12 },
          pb: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="h2"
                component="h1"
                gutterBottom
                fontWeight="bold"
                sx={{ fontSize: { xs: '2rem', md: '3rem' } }}
              >
                Power Wallet
              </Typography>
              <Typography
                variant="h5"
                component="h2"
                gutterBottom
                sx={{ opacity: 0.95, mb: 4, fontSize: { xs: '1.25rem', md: '1.5rem' } }}
              >
              Bitcoin accumulation on autopilot
            </Typography>
              <Box component="ul" sx={{ opacity: 0.9, mb: 6, pl: 3, m: 0 }}>
                <li>
                  <Typography variant="body1"><strong>Power up</strong> your Bitcoin investments with proven DCA strategies automated on-chain.</Typography>
                </li>
                <li>
                  <Typography variant="body1">Stack more Bitcoin with the benefits of <strong>built-in risk management</strong>.</Typography>
                </li>
                <li>
                  <Typography variant="body1">Maintain <strong>full custody</strong> with blockchain-based secure, transparent, verifiable execution. </Typography>
                </li>
              </Box>
              <Stack direction={{ xs: 'row', sm: 'row' }} spacing={2} sx={{ mt: 5, flexWrap: 'nowrap' }}>
                <Link href="/portfolio" passHref style={{ textDecoration: 'none' }}>
                  <Button
                    variant="contained"
                    size="large"
                    sx={{
                      background: 'linear-gradient(45deg, #F59E0B 30%, #FB923C 90%)',
                      color: 'white',
                      boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.39)',
                      '&:hover': {
                        boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
                      },
                    }}
                  >
                    Start Investing
                  </Button>
                </Link>
                <Link href="/simulator?strategy=smart" passHref style={{ textDecoration: 'none' }}>
                  <Button
                    variant="outlined"
                    size="large"
                    sx={{
                      borderColor: '#F59E0B',
                      color: '#F59E0B',
                      '&:hover': {
                        borderColor: '#FB923C',
                        bgcolor: 'rgba(245, 158, 11, 0.1)',
                      },
                    }}
                  >
                    Try The Simulator
                  </Button>
                </Link>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AccountBalanceWalletIcon
                  sx={{
                    fontSize: { xs: 120, md: 200 },
                    color: 'primary.main',
                    filter: 'drop-shadow(0 0 30px rgba(245, 158, 11, 0.5))',
                  }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 7 } }}>
        <Typography
          variant="h3"
          component="h2"
          textAlign="center"
          gutterBottom
          fontWeight="bold"
          sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' } }}
        >
          Why Power Wallet?
        </Typography>
        <Typography
          variant="body1"
          textAlign="center"
          color="text.secondary"
          sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}
        >
          Experience the future of Bitcoin investing with smart, on-chain wallets that accumulate Bitcoin and rebalance your portfolio for you.
        </Typography>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: 6,
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                  <Box
                    sx={{
                      color: 'primary.main',
                      mb: 2,
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" component="h3" gutterBottom fontWeight="bold">
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      
      {/* Our Strategies Section */}
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 7 } }}>
        <Typography
          variant="h3"
          component="h2"
          textAlign="center"
          gutterBottom
          fontWeight="bold"
          sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' } }}
        >
          Our Strategies
        </Typography>
        <Typography
          variant="body1"
          textAlign="center"
          color="text.secondary"
          sx={{ mb: 6, maxWidth: 720, mx: 'auto' }}
        >
          Four disciplined, on‑chain DCA approaches designed for different preferences. Pick the one that fits your goals and risk appetite.
        </Typography>

        <Grid container spacing={4}>
          {[
            {
              key: 'pure',
              title: 'Pure DCA',
              subtitle: 'Set‑and‑forget accumulation',
              desc: 'Buy a fixed amount on a fixed cadence. Best for long‑term believers who are price insensitive and prefer simplicity.',
            },
            {
              key: 'power',
              title: 'Power DCA',
              subtitle: 'Power‑law fair‑value trend',
              desc: 'Scale buys below bitcoin power-law model price and trim above. Ideal for mean‑reversion believers seeking efficiency.',
            },
            {
              key: 'smart',
              title: 'Smart DCA',
              subtitle: 'Buy the dip and rebalance',
              desc: 'Adaptive buys and sells based on volatility and drawdown, with optional threshold rebalancing to a BTC weight band.',
            },
            {
              key: 'trend',
              title: 'Trend DCA',
              subtitle: 'Trend aligned accumulation',
              desc: 'All‑in BTC in confirmed uptrends, gentle DCA in downtrends, boosted buys when well below trend.',
            },
          ].map((s, i) => (
            <Grid item xs={12} sm={6} md={3} key={s.key}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid',
                  borderColor: 'divider',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  '&:hover': { transform: 'translateY(-6px)', boxShadow: 5 },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="overline" color="primary" sx={{ letterSpacing: 0.6 }}>
                    {s.subtitle}
                  </Typography>
                  <Typography variant="h6" component="h3" gutterBottom fontWeight="bold">
                    {s.title}
                  </Typography>
                  <Box sx={{
                    height: 80,
                    mb: 2,
                    borderRadius: 1,
                    bgcolor: 'rgba(245, 158, 11, 0.10)',
                    border: '1px dashed rgba(245, 158, 11, 0.35)'
                  }} />
                  <Typography variant="body2" color="text.secondary">{s.desc}</Typography>
                </CardContent>
                <Box sx={{ px: 2, pb: 2 }}>
                  <Link href={`/simulator?strategy=${s.key}`} passHref style={{ textDecoration: 'none' }}>
                    <Button fullWidth variant="outlined" size="small" sx={{ borderColor: 'primary.main', color: 'primary.main' }}>
                      Try in Simulator
                    </Button>
                  </Link>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* How It Works Section */}
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 7 }, pb: { xs: 6, md: 7 } }}>
        <Typography
          variant="h3"
          component="h2"
          textAlign="center"
          gutterBottom
          fontWeight="bold"
          sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' } }}
        >
          How to Get Started
        </Typography>
        <Typography
          variant="body1"
          textAlign="center"
          color="text.secondary"
          sx={{ mb: 6, maxWidth: 720, mx: 'auto' }}
        >
          Get started in 3 simple step, and start bitcoin accumulation on autopilot today.
        </Typography>

        <Grid container spacing={4}>
          {[
            { step: 1, title: 'Create a Power Wallet', desc: 'Deploy your new on‑chain smart wallet in seconds.' },
            { step: 2, title: 'Pick a DCA Strategy', desc: 'Choose between Pure, Power, Smart, or Trend based on your goals.' },
            { step: 3, title: 'Deposit USDC', desc: 'Fund your wallet with USDC to start investing.' },
            { step: 4, title: 'Enjoy a peace of mind', desc: 'Let your strategy execute on‑chain while you enjoy a peace of mind.' },
          ].map((d) => (
            <Grid item xs={12} sm={6} md={3} key={d.step}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="overline" color="primary">{d.step < 4 ? `Step ${d.step}` : 'Done'}</Typography>
                  <Typography variant="h6" component="h3" gutterBottom fontWeight="bold">{d.title}</Typography>
                  <Box sx={{
                    height: 120,
                    mb: 2,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px dashed rgba(255,255,255,0.12)'
                  }} />
                  <Typography variant="body2" color="text.secondary">{d.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1A1A1A 0%, #2D1B0E 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 70% 50%, rgba(245, 158, 11, 0.2) 0%, transparent 50%)',
            pointerEvents: 'none',
          },
          color: 'white',
          py: { xs: 6, md: 8 },
        }}
      >
        <Container maxWidth="md">
          <Stack spacing={3} alignItems="center" textAlign="center" sx={{ position: 'relative', zIndex: 1 }}>
            <Typography variant="h3" fontWeight="bold" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' } }}>
              Ready to Start Smart Investing?
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Create your first Power Wallet and begin your journey into 
              self-sovereign, algorithmic, on-chain investing.
            </Typography>
            <Button
              variant="contained"
              size="large"
              sx={{
                background: 'linear-gradient(45deg, #F59E0B 30%, #FB923C 90%)',
                color: 'white',
                px: 4,
                boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.39)',
                '&:hover': {
                  boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
                },
              }}
            >
              <Link href="/portfolio" style={{ textDecoration: 'none', color: 'inherit' }}>
                Get Started
              </Link>
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
