'use client';

import React, { useMemo } from 'react';
import { Container, Box, Typography, Accordion, AccordionSummary, AccordionDetails, Stack, Grid, IconButton, Tooltip, TextField, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LaunchIcon from '@mui/icons-material/Launch';
import { useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { getViemChain } from '@/config/networks';
import appConfig from '@/config/appConfig.json';
import { getChainKey } from '@/config/networks';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import { useReadContract } from 'wagmi';
import WalletSummaryCard from '@/app/wallet/WalletSummaryCard';

const factoryAbi = [
  { type: 'function', name: 'getUsers', stateMutability: 'view', inputs: [], outputs: [ { type: 'address[]' } ] },
  { type: 'function', name: 'getUserWallets', stateMutability: 'view', inputs: [ { name: 'user', type: 'address' } ], outputs: [ { type: 'address[]' } ] },
  { type: 'function', name: 'deleteWallet', stateMutability: 'nonpayable', inputs: [ { name: 'walletAddr', type: 'address' } ], outputs: [] },
] as const;

const walletAbi = [
  { type: 'function', name: 'getBalances', stateMutability: 'view', inputs: [], outputs: [ { type: 'uint256' }, { type: 'uint256[]' } ] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [ { name: 'amount', type: 'uint256' } ], outputs: [] },
] as const;

export default function UsersPage() {
  const chainId = useChainId();
  const chainKey = getChainKey(chainId);
  const explorerBase = (appConfig as any)[chainKey]?.explorer || '';
  const factory = contractAddresses[chainKey]?.walletFactory as `0x${string}` | undefined;
  const { writeContractAsync } = useWriteContract();
  const [toDelete, setToDelete] = React.useState<string>('');
  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [msg, setMsg] = React.useState<string>('');

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
                  <Tooltip title="Copy address">
                    <IconButton size="small" aria-label="Copy address" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(u).catch(() => {}); }}>
                      <ContentCopyIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Open in block explorer">
                    <IconButton size="small" aria-label="Open in explorer" onClick={(e) => { e.stopPropagation(); window.open(`${explorerBase}/address/${u}`, '_blank', 'noopener'); }}>
                      <LaunchIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
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

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>Unregister wallet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Enter a wallet address you own to remove it from the registry.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              fullWidth
              size="small"
              label="Wallet address (0x…)"
              value={toDelete}
              onChange={(e) => setToDelete(e.target.value)}
            />
            <Button
              variant="outlined"
              disabled={!factory || !/^0x[a-fA-F0-9]{40}$/.test(toDelete) || Boolean(isConfirming)}
              onClick={async () => {
                try {
                  setMsg('');
                  const hash = await writeContractAsync({
                    address: factory as `0x${string}`,
                    abi: factoryAbi as any,
                    functionName: 'deleteWallet',
                    args: [toDelete as `0x${string}`],
                  });
                  setTxHash(hash as `0x${string}`);
                  setMsg('Transaction submitted. Waiting for confirmation…');
                } catch (e: any) {
                  setMsg(e?.shortMessage || e?.message || 'Failed to submit transaction');
                }
              }}
            >
              Unregister
            </Button>
            <Button
              variant="contained"
              disabled={!/^0x[a-fA-F0-9]{40}$/.test(toDelete) || Boolean(isConfirming)}
              onClick={async () => {
                try {
                  setMsg('');
                  const client = createPublicClient({ chain: getViemChain(chainId), transport: http() });
                  const res = await client.readContract({ address: toDelete as `0x${string}`, abi: walletAbi as any, functionName: 'getBalances', args: [] }) as any;
                  const stableBal = (Array.isArray(res) ? res[0] : 0n) as bigint;
                  if (!stableBal || stableBal === 0n) { setMsg('No stable balance to withdraw'); return; }
                  const hash = await writeContractAsync({
                    address: toDelete as `0x${string}`,
                    abi: walletAbi as any,
                    functionName: 'withdraw',
                    args: [stableBal],
                  });
                  setTxHash(hash as `0x${string}`);
                  setMsg('Withdrawal submitted. Waiting for confirmation…');
                } catch (e: any) {
                  setMsg(e?.shortMessage || e?.message || 'Failed to submit withdrawal');
                }
              }}
            >
              Withdraw all (stable)
            </Button>
          </Stack>
          {msg ? (
            <Typography variant="caption" color={isConfirmed ? 'success.main' : 'text.secondary'} sx={{ mt: 1, display: 'block' }}>
              {isConfirmed ? 'Transaction confirmed.' : msg}
            </Typography>
          ) : null}
        </Box>
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


