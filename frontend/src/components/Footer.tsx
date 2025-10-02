'use client';

import React, { useEffect, useState } from 'react';
import { Box, Container, Typography, Stack } from '@mui/material';

function formatUSD0(value?: number): string {
  if (!value || !isFinite(value)) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const Footer: React.FC = () => {
  const [btc, setBtc] = useState<number | undefined>(undefined);
  const [eth, setEth] = useState<number | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function fetchPrices() {
      try {
        const [btcRes, ethRes] = await Promise.all([
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', { signal: controller.signal }),
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT', { signal: controller.signal }),
        ]);
        if (!btcRes.ok || !ethRes.ok) return;
        const btcJson = await btcRes.json();
        const ethJson = await ethRes.json();
        if (!mounted) return;
        setBtc(Number(btcJson?.price));
        setEth(Number(ethJson?.price));
      } catch (_) {
        // ignore network errors
      }
    }

    fetchPrices();
    const id = setInterval(fetchPrices, 60_000);
    return () => {
      mounted = false; clearInterval(id); controller.abort();
    };
  }, []);

  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderTop: '1px solid #2D2D2D',
        mt: 6,
        py: 2,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Typography variant="body2">
            <strong>BTC</strong>: ${formatUSD0(btc)} &nbsp; | &nbsp; <strong>ETH</strong>: ${formatUSD0(eth)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            © {year} Power Wallet. All rights reserved.
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;


