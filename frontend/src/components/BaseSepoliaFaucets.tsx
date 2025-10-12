'use client';

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';

export default function BaseSepoliaFaucets() {
  const links = [
    { href: 'https://faucet.circle.com/', label: 'Circle USDC Faucet' },
    { href: 'https://faucets.chain.link/base-sepolia', label: 'Chainlink Base Sepolia Faucet (ETH)' },
    { href: 'https://portal.cdp.coinbase.com/products/faucet', label: 'Coinbase Developer Faucet' },
  ];
  return (
    <>
      <Typography variant="body2" sx={{ pb: 1 }}>On Base Sepolia testnet, you can use the following faucets:</Typography>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {links.map((link) => (
          <li key={link.href}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{link.label}</a>
              <Tooltip title="Open in new tab">
                <LaunchIcon sx={{ fontSize: 14, color: 'inherit' }} />
              </Tooltip>
            </Box>
          </li>
        ))}
      </ul>
    </>
  );
}


