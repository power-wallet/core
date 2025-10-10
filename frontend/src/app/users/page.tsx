'use client';

import React, { useMemo } from 'react';
import { Container, Box, Typography, Accordion, AccordionSummary, AccordionDetails, Stack, Grid, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LaunchIcon from '@mui/icons-material/Launch';
import { useChainId } from 'wagmi';
import appConfig from '@/config/appConfig.json';
import { getChainKey } from '@/config/networks';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import { useReadContract } from 'wagmi';
import WalletSummaryCard from '@/app/wallet/WalletSummaryCard';

const factoryAbi = [
  { type: 'function', name: 'getUsers', stateMutability: 'view', inputs: [], outputs: [ { type: 'address[]' } ] },
  { type: 'function', name: 'getUserWallets', stateMutability: 'view', inputs: [ { name: 'user', type: 'address' } ], outputs: [ { type: 'address[]' } ] },
] as const;

export default function UsersPage() {
  const chainId = useChainId();
  const chainKey = getChainKey(chainId);
  const explorerBase = (appConfig as any)[chainKey]?.explorer || '';
  const factory = contractAddresses[chainKey]?.walletFactory as `0x${string}` | undefined;

  const { data: users } = useReadContract({
    address: factory,
    abi: factoryAbi as any,
    functionName: 'getUsers',
    query: { enabled: Boolean(factory) },
  });

  const userList = useMemo(() => (users as string[] | undefined) || [], [users]);

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Users</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        All addresses that have created at least one Power Wallet on this network.
      </Typography>

      <Stack spacing={2}>
        {userList.map((u) => (
          <Accordion key={u} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
                <Typography sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u}</Typography>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton size="small" aria-label="Copy address" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(u).catch(() => {}); }}>
                    <ContentCopyIcon fontSize="inherit" />
                  </IconButton>
                  <IconButton size="small" aria-label="Open in explorer" onClick={(e) => { e.stopPropagation(); window.open(`${explorerBase}/address/${u}`, '_blank', 'noopener'); }}>
                    <LaunchIcon fontSize="inherit" />
                  </IconButton>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <UserWallets user={u as `0x${string}`} explorerBase={explorerBase} />
            </AccordionDetails>
          </Accordion>
        ))}
        {userList.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No users yet.</Typography>
        ) : null}
      </Stack>
    </Container>
  );
}

function UserWallets({ user, explorerBase }: { user: `0x${string}`; explorerBase: string }) {
  const chainId = useChainId();
  const chainKey = getChainKey(chainId);
  const factory = contractAddresses[chainKey]?.walletFactory as `0x${string}` | undefined;
  const { data: wallets } = useReadContract({
    address: factory,
    abi: factoryAbi as any,
    functionName: 'getUserWallets',
    args: [user],
    query: { enabled: Boolean(factory && user) },
  });
  const list = useMemo(() => (wallets as string[] | undefined) || [], [wallets]);
  const feeClient = undefined as any; // not required by WalletSummaryCard for reads
  return (
    <Grid container spacing={2}>
      {list.map((w) => (
        <Grid key={w} item xs={12} md={6}>
          <WalletSummaryCard walletAddress={w as `0x${string}`} explorerBase={explorerBase} feeClient={feeClient} />
        </Grid>
      ))}
      {list.length === 0 ? (
        <Grid item xs={12}><Typography variant="body2" color="text.secondary">No wallets found for this user.</Typography></Grid>
      ) : null}
    </Grid>
  );
}


