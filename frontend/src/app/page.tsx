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
  IconButton,
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SecurityIcon from '@mui/icons-material/Security';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Link from 'next/link';
import Image from 'next/image';

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
      icon: <LightbulbIcon sx={{ fontSize: 48 }} />,
      title: 'Smart Investing',
      description: 'Optimize your Bitcoin and digital asset returns, manage risk so you can enjoy a peace of mind.',
    },
  ];

  const steps = [
    { step: 1, title: 'Create a Power Wallet', desc: 'Deploy your new on‑chain smart wallet in seconds.' },
    { step: 2, title: 'Pick a DCA Strategy', desc: 'Choose between Pure, Power, Smart, or Trend based on your goals.' },
    { step: 3, title: 'Deposit USDC', desc: 'Fund your wallet with USDC so that your strategy can start investing.' },
    { step: 4, title: 'Enjoy a peace of mind', desc: 'Let your strategy execute on‑chain while you enjoy a peace of mind.' },
  ];

  const [stepIndex, setStepIndex] = React.useState(0);
  const nextStep = React.useCallback(() => setStepIndex((i) => (i + 1) % steps.length), [steps.length]);
  const prevStep = React.useCallback(() => setStepIndex((i) => (i - 1 + steps.length) % steps.length), [steps.length]);

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
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 7 } }}>
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
          sx={{ mb: 6, maxWidth: 740, mx: 'auto' }}
        >
          Fear, greed and lack of discipline prevent do-it-yourself investors from building real wealth.
          Power Wallet fixes that. Our automated, secure and transparent Bitcoin accumulation strategies 
          help you avoid common mistakes, so you can be a successful long-term investor.
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
      
      {/* Our Strategies Section (with gradient background) */}
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
            background: 'radial-gradient(circle at 70% 40%, rgba(245, 158, 11, 0.18) 0%, transparent 55%)',
            pointerEvents: 'none',
          },
          color: 'white',
          py: { xs: 6, md: 8 },
        }}
      >
        <Container maxWidth="lg">
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
            sx={{ mb: 6, mt: 2, maxWidth: 720, mx: 'auto', opacity: 0.9 }}
          >
            Four disciplined, on‑chain DCA approaches designed for different preferences. Pick the one that fits your goals and risk appetite.
          </Typography>

          <Grid container spacing={4}>
            {[
              {
                key: 'pure',
                title: 'Pure',
                subtitle: 'Set‑and‑forget accumulation',
                desc: 'Buy a fixed amount on a fixed cadence. Best for long‑term believers who are price insensitive and prefer simplicity.',
              },
              {
                key: 'power',
                title: 'Power',
                subtitle: 'Power‑law fair‑value trend',
                desc: 'Scale buys below bitcoin power-law model price and trim above. Ideal for mean‑reversion believers seeking efficiency.',
              },
              {
                key: 'smart',
                title: 'Smart',
                subtitle: 'Buy the dip and rebalance',
                desc: 'Adaptive buys and sells based on volatility and drawdown, with optional threshold rebalancing to a BTC weight band.',
              },
              {
                key: 'trend',
                title: 'Trend',
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
                    borderColor: 'rgba(255,255,255,0.15)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                    backdropFilter: 'blur(2px)',
                    transition: 'transform 0.3s, box-shadow 0.3s',
                    '&:hover': { transform: 'translateY(-6px)', boxShadow: 8 },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="overline" color="primary" sx={{ letterSpacing: 0.6 }}>
                      {s.subtitle}
                    </Typography>
                    <Typography variant="h6" component="h3" gutterBottom fontWeight="bold" sx={{ color: 'white' }}>
                      {s.title}
                    </Typography>
                    <Box sx={{
                      height: 100,
                      mb: 2,
                      borderRadius: 1,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(255,255,255,0.04)',
                      border: '1px dashed rgba(255,255,255,0.18)'
                    }}>
                      <Image
                        src={`/img/strategies/${s.key}.png`}
                        alt={`${s.title} illustration`}
                        width={800}
                        height={240}
                        style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>{s.desc}</Typography>
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
      </Box>

      {/* How to Get Started Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 7 } }}>
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
          sx={{ mb: 2, mt: 2, maxWidth: 720, mx: 'auto' }}
        >
          Create yuor first Power Wallet in 3 simple step, and start accumulating bitcoin today.
        </Typography>

        {/* Mobile carousel */}
        <Box sx={{ display: { xs: 'block', md: 'none' }, position: 'relative', pt: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="primary">{stepIndex < 3 ? `Step ${steps[stepIndex].step}` : 'Done'}</Typography>
              <Typography variant="h6" component="h3" gutterBottom fontWeight="bold">{steps[stepIndex].title}</Typography>
              <Box sx={{
                height: 180,
                mb: 2,
                borderRadius: 1,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px dashed rgba(255,255,255,0.18)'
              }}>
                <Image
                  src={`/img/getstarted/step-${steps[stepIndex].step}.png`}
                  alt={`${steps[stepIndex].title} illustration`}
                  width={900}
                  height={300}
                  style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">{steps[stepIndex].desc}</Typography>
            </CardContent>
          </Card>
          <IconButton aria-label="Previous" onClick={prevStep} sx={{ position: 'absolute', top: '50%', left: 8, transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.35)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}>
            <ChevronLeftIcon />
          </IconButton>
          <IconButton aria-label="Next" onClick={nextStep} sx={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', bgcolor: 'rgba(0,0,0,0.35)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}>
            <ChevronRightIcon />
          </IconButton>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center" justifyContent="center">
            {steps.map((_, i) => (
              <Box key={i} onClick={() => setStepIndex(i)} role="button" aria-label={`Go to step ${i + 1}`} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: i === stepIndex ? 'primary.main' : 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.2)', cursor: 'pointer' }} />
            ))}
          </Stack>
        </Box>

        {/* Desktop grid */}
        <Grid container spacing={4} sx={{ display: { xs: 'none', md: 'flex' }, mt: 0 }}>
          {steps.map((d) => (
            <Grid item xs={12} sm={6} md={3} key={d.step}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="overline" color="primary">{d.step < 4 ? `Step ${d.step}` : 'Done'}</Typography>
                  <Typography variant="h6" component="h3" gutterBottom fontWeight="bold">{d.title}</Typography>
                  <Box sx={{
                    height: 140,
                    mb: 2,
                    borderRadius: 1,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px dashed rgba(255,255,255,0.18)'
                  }}>
                    <Image
                      src={`/img/getstarted/step-${d.step}.png`}
                      alt={`${d.title} illustration`}
                      width={800}
                      height={260}
                      style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                    />
                  </Box>
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
      
      {/* Our Tech Section */}
      <Box sx={{ pt: { xs: 6, md: 8 }, pb: { xs: 2, md: 2 }, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Typography variant="h3" textAlign="center" fontWeight="bold" sx={{ mb: 1, fontSize: { xs: '1.75rem', md: '2.25rem' } }}>
            Our Tech
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4, maxWidth: 720, mx: 'auto' }}>
            Power Wallet is built on the Base blockchain, with Chainlink Automation, Coinbase Smart Wallet, Uniswap V3, cbBTC and USDC.
          </Typography>

          {/* Mobile: horizontal scroller */}
          <Box sx={{
            display: { xs: 'flex', md: 'none' },
            gap: 3,
            overflowX: 'auto',
            px: 1,
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch'
          }}>
            {[
              { src: '/img/tech/base.jpeg', alt: 'Base blockchain' },
              { src: '/img/tech/coinbase-smart-wallet.jpeg', alt: 'Coinbase Smart Wallet' },
              { src: '/img/tech/cbbtc.jpeg', alt: 'cbBTC' },
              { src: '/img/tech/chainlink-automation.jpeg', alt: 'Chainlink Automation' },
              { src: '/img/tech/uniswap.jpeg', alt: 'Uniswap' },
            ].map((t) => (
              <Box key={t.src} sx={{
                minWidth: 180,
                scrollSnapAlign: 'start',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper'
              }}>
                <Image
                  src={t.src}
                  alt={t.alt}
                  width={240}
                  height={120}
                  style={{ maxHeight: 80, objectFit: 'contain', width: '100%', filter: 'grayscale(10%)', opacity: 0.9 }}
                />
              </Box>
            ))}
          </Box>

          {/* Desktop: wrapped row */}
          <Box sx={{
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flexWrap: 'wrap'
          }}>
            {[
              { src: '/img/tech/base.jpeg', alt: 'Base blockchain' },
              { src: '/img/tech/coinbase-smart-wallet.jpeg', alt: 'Coinbase Smart Wallet' },
              { src: '/img/tech/cbbtc.jpeg', alt: 'cbBTC' },
              { src: '/img/tech/chainlink-automation.jpeg', alt: 'Chainlink Automation' },
              { src: '/img/tech/uniswap.jpeg', alt: 'Uniswap' },
            ].map((t) => (
              <Box key={t.src} sx={{ p: 0 }}>
                <Image
                  src={t.src}
                  alt={t.alt}
                  width={280}
                  height={120}
                  style={{ maxHeight: 88, objectFit: 'contain', width: '100%', opacity: 0.9 }}
                />
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

    </Box>
  );
}
