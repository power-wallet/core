'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Container, Stack, Typography, ToggleButtonGroup, ToggleButton, TextField, Grid, Snackbar, Alert } from '@mui/material';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { encodeFunctionData } from 'viem';
import WalletConnectModal from '@/components/WalletConnectModal';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import strategies from '@/lib/strategies/strategies.json';

// Minimal ABI for WalletFactory functions we call
const walletFactoryAbi = [
  {
    type: 'function',
    name: 'getUserWallets',
    stateMutability: 'view',
    inputs: [{ name: 'user', internalType: 'address', type: 'address' }],
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'createWallet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'strategyId', internalType: 'bytes32', type: 'bytes32' },
      { name: 'strategyInitData', internalType: 'bytes', type: 'bytes' },
      { name: 'stableAsset', internalType: 'address', type: 'address' },
      { name: 'riskAssets', internalType: 'address[]', type: 'address[]' },
      { name: 'priceFeeds', internalType: 'address[]', type: 'address[]' },
      { name: 'poolFees', internalType: 'uint24[]', type: 'uint24[]' },
    ],
    outputs: [{ name: 'walletAddr', internalType: 'address', type: 'address' }],
  },
];

export default function PortfolioPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [connectOpen, setConnectOpen] = useState(false);
  // Onboarding params (must be top-level to preserve hooks order)
  const [amount, setAmount] = useState<string>('100');
  const [frequency, setFrequency] = useState<string>('86400'); // 1 day in seconds
  const [creating, setCreating] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'info' | 'success' | 'error' }>(() => ({ open: false, message: '', severity: 'info' }));

  function getExplorerBase(id?: number) {
    if (id === 8453) return 'https://basescan.org';
    if (id === 84532) return 'https://sepolia.basescan.org';
    return '';
  }

  useEffect(() => {
    if (txHash) {
      setToast({ open: true, message: 'Transaction submitted. Waiting for confirmation…', severity: 'info' });
    }
  }, [txHash]);

  useEffect(() => {
    if (isConfirmed && txHash) {
      setToast({ open: true, message: `Transaction confirmed: ${txHash}`, severity: 'success' });
    }
  }, [isConfirmed, txHash]);

  const chainKey = useMemo(() => {
    if (chainId === 84532) return 'base-sepolia';
    if (chainId === 8453) return 'base';
    return 'base-sepolia';
  }, [chainId]);

  const factoryAddress = contractAddresses[chainKey]?.walletFactory;

  const { data: userWallets, isLoading } = useReadContract({
    abi: walletFactoryAbi as any,
    address: factoryAddress as `0x${string}` | undefined,
    functionName: 'getUserWallets',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isConnected && address && factoryAddress) },
  });

  if (!isConnected) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={3} alignItems="center" textAlign="center">
          <Typography variant="h4" fontWeight="bold">Connect your wallet</Typography>
          <Typography variant="body1" color="text.secondary">
            Connect your web3 wallet to view and manage your on-chain Power Wallets.
          </Typography>
          <Button variant="contained" onClick={() => setConnectOpen(true)}>Connect Wallet</Button>
        </Stack>
        <WalletConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  const wallets = (userWallets as string[] | undefined) || [];

  if (!factoryAddress) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography color="error">WalletFactory address is not configured for this chain.</Typography>
      </Container>
    );
  }

  if (wallets.length === 0) {

    const strategyPreset = (strategies as any)['simple-dca-v1'];

    const addressesForChain = contractAddresses[chainKey];
    const usdc = addressesForChain.usdc;
    const cbBTC = addressesForChain.cbBTC || addressesForChain.wbtc || addressesForChain.weth; // risk asset preference
    const priceFeeds = [addressesForChain.btcUsdPriceFeed];
    const poolFees = [3000]; // 0.3% default

    const strategyIdBytes32 = strategyPreset.idBytes32 as `0x${string}`;

    const simpleDcaInit = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'initialize',
          stateMutability: 'nonpayable',
          inputs: [
            { name: '_risk', type: 'address' },
            { name: '_stable', type: 'address' },
            { name: '_amountStable', type: 'uint256' },
            { name: '_frequency', type: 'uint256' },
            { name: 'desc', type: 'string' },
          ],
          outputs: [],
        },
      ],
      functionName: 'initialize',
      args: [cbBTC as `0x${string}`, usdc as `0x${string}`, BigInt(Number(amount) * 1_000_000), BigInt(frequency), strategyPreset.description],
    });

    const onCreate = async () => {
      if (!factoryAddress || !cbBTC || !strategyIdBytes32) return;
      setCreating(true);
      try {
        const hash = await writeContractAsync({
          address: factoryAddress as `0x${string}`,
          abi: walletFactoryAbi as any,
          functionName: 'createWallet',
          args: [
            strategyIdBytes32,
            simpleDcaInit,
            usdc as `0x${string}`,
            [cbBTC as `0x${string}`],
            priceFeeds as [`0x${string}`],
            poolFees,
          ],
        });
        setTxHash(hash as `0x${string}`);
      } finally {
        setCreating(false);
      }
    };
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" fontWeight="bold">Welcome to Power Wallet</Typography>
          <Typography variant="body1" color="text.secondary">
            Create your first on-chain Power Wallet to start investing with automated strategies.
          </Typography>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight="bold">Select Strategy</Typography>
                <Typography variant="body2">Simple DCA</Typography>
                <Typography variant="caption" color="text.secondary">{strategyPreset.description}</Typography>

                <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>Parameters</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                  <TextField
                    label="DCA amount (USDC)"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputProps={{ min: 1 }}
                  />
                  <Box>
                    <Typography variant="caption" display="block" sx={{ mb: 1 }}>Frequency</Typography>
                    <ToggleButtonGroup
                      value={frequency}
                      exclusive
                      onChange={(_, val) => val && setFrequency(val)}
                      size="small"
                    >
                      <ToggleButton value={String(60 * 60 * 24)}>1d</ToggleButton>
                      <ToggleButton value={String(60 * 60 * 24 * 3)}>3d</ToggleButton>
                      <ToggleButton value={String(60 * 60 * 24 * 5)}>5d</ToggleButton>
                      <ToggleButton value={String(60 * 60 * 24 * 7)}>1w</ToggleButton>
                      <ToggleButton value={String(60 * 60 * 24 * 14)}>2w</ToggleButton>
                      <ToggleButton value={String(60 * 60 * 24 * 30)}>1m</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                  <Button variant="contained" disabled={creating || isConfirming} onClick={onCreate}>
                    {creating || isConfirming ? 'Creating…' : 'Create Power Wallet'}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          <Snackbar
            open={toast.open}
            autoHideDuration={6000}
            onClose={() => setToast((t) => ({ ...t, open: false }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={() => setToast((t) => ({ ...t, open: false }))} severity={toast.severity} sx={{ width: '100%' }}>
              {toast.severity === 'success' && txHash ? (
                <>
                  Transaction confirmed.{' '}
                  {getExplorerBase(chainId) ? (
                    <a href={`${getExplorerBase(chainId)}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                      View on explorer
                    </a>
                  ) : null}
                </>
              ) : (
                toast.message
              )}
            </Alert>
          </Snackbar>
        </Stack>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Your Portfolio</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Connected: {address}
      </Typography>

      <Grid container spacing={3}>
        {wallets.map((w) => (
          <Grid item xs={12} md={6} key={w}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" color="text.secondary">PowerWallet</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{w}</Typography>
                  <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                    <Button size="small" variant="outlined" href={`/wallet?address=${w}`}>Open</Button>
                    <Button size="small" variant="text">Deposit</Button>
                    <Button size="small" variant="text">Withdraw</Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}


