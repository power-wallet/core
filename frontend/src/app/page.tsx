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
  useTheme,
  useMediaQuery,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import Link from 'next/link';

export default function Home() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const features = [
    {
      icon: <AccountBalanceWalletIcon sx={{ fontSize: 48 }} />,
      title: 'On-Chain Wallets',
      description: 'Create multiple smart wallets directly on the blockchain. Your funds, your control.',
    },
    {
      icon: <AutoGraphIcon sx={{ fontSize: 48 }} />,
      title: 'Automated Strategies',
      description: 'Deploy proven trading strategies that manage your investments 24/7 using technical indicators.',
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 48 }} />,
      title: 'Secure & Transparent',
      description: 'All transactions happen on-chain. Fully auditable, secure, and transparent.',
    },
    {
      icon: <TrendingUpIcon sx={{ fontSize: 48 }} />,
      title: 'Smart Investing',
      description: 'Deposit USDC and let algorithmic strategies optimize your Bitcoin and digital asset investments.',
    },
  ];

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
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
                variant={isMobile ? 'h3' : 'h2'}
                component="h1"
                gutterBottom
                fontWeight="bold"
              >
                Power Wallet
              </Typography>
              <Typography
                variant={isMobile ? 'h6' : 'h5'}
                component="h2"
                gutterBottom
                sx={{ opacity: 0.95, mb: 4 }}
              >
                Smart On-Chain Investing in Bitcoin & Digital Assets
              </Typography>
              <Typography variant="body1" paragraph sx={{ opacity: 0.9, mb: 4 }}>
                Power Wallet automates the management of your portfolio of bitcoin and digital assets. <br />
                Deploy your capital into intelligent investment strategies. <br />
                Enjoy the security of blockchain and the benefits of automated risk management.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Link href="/simulator" passHref style={{ textDecoration: 'none' }}>
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
                    Try the Simulator
                  </Button>
                </Link>
                <Link href="/about" passHref style={{ textDecoration: 'none' }}>
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
                    Learn More
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
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Typography
          variant={isMobile ? 'h4' : 'h3'}
          component="h2"
          textAlign="center"
          gutterBottom
          fontWeight="bold"
        >
          Why Power Wallet?
        </Typography>
        <Typography
          variant="body1"
          textAlign="center"
          color="text.secondary"
          sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}
        >
          Experience the future of digital asset management with our on-chain platform
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
            <Typography variant={isMobile ? 'h4' : 'h3'} fontWeight="bold">
              Ready to Start Smart Investing?
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Connect your wallet or create a new one to begin your journey into 
              automated, on-chain investment strategies.
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
              Get Started
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
