'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Container, Stack, Typography, ToggleButtonGroup, ToggleButton, TextField, Grid, Snackbar, Alert } from '@mui/material';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { encodeFunctionData, createPublicClient, http, parseUnits } from 'viem';
import { getViemChain, getChainKey } from '@/config/networks';
import { baseSepolia } from 'wagmi/chains';
import WalletConnectModal from '@/components/WalletConnectModal';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import appConfig from '@/config/appConfig.json';

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
  const { switchChainAsync } = useSwitchChain();
  const chainName = useMemo(() => {
    if (!chainId) return 'this network';
    try {
      const key = getChainKey(chainId);
      return key === 'base' ? 'Base' : 'Base Sepolia';
    } catch {
      return `Chain ${chainId}`;
    }
  }, [chainId]);
  const [connectOpen, setConnectOpen] = useState(false);
  // Onboarding params (must be top-level to preserve hooks order)
  const [amount, setAmount] = useState<string>('100');
  const [frequency, setFrequency] = useState<string>('86400'); // 1 day in seconds
  const [creating, setCreating] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'info' | 'success' | 'error' }>(() => ({ open: false, message: '', severity: 'info' }));


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

  const chainKey = useMemo(() => getChainKey(chainId), [chainId]);

  const explorerBase = (appConfig as any)[chainKey]?.explorer || '';

  const feeClient = useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http() }), [chainId]);

  const factoryAddress = contractAddresses[chainKey]?.walletFactory;

  const { data: userWallets, isLoading, refetch: refetchWallets } = useReadContract({
    abi: walletFactoryAbi as any,
    address: factoryAddress as `0x${string}` | undefined,
    functionName: 'getUserWallets',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isConnected && address && factoryAddress) },
  });

  // After success, refetch wallets without full page reload
  useEffect(() => {
    if (!isConfirmed || !txHash) return;
    (async () => {
      try {
        await refetchWallets();
        setTimeout(() => {
          refetchWallets().catch(() => {});
        }, 1500);
      } catch {}
    })();
  }, [isConfirmed, txHash, refetchWallets]);

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
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography color="warning">Power Wallet is not available on {chainName}. Please switch to Base Sepolia Testnet.</Typography>
          <Button variant="contained" onClick={async () => {
            try {
              await switchChainAsync({ chainId: baseSepolia.id });
            } catch (_) {
              try {
                const params = {
                  chainId: `0x${baseSepolia.id.toString(16)}`,
                  chainName: baseSepolia.name,
                  nativeCurrency: baseSepolia.nativeCurrency,
                  rpcUrls: [baseSepolia.rpcUrls.default.http[0]],
                  blockExplorerUrls: [baseSepolia.blockExplorers?.default.url || ''],
                } as const;
                await (window as any)?.ethereum?.request({ method: 'wallet_addEthereumChain', params: [params] });
                await switchChainAsync({ chainId: baseSepolia.id });
              } catch {}
            }
          }}>
            Switch to Base Sepolia
          </Button>
        </Stack>
      </Container>
    );
  }

  if (wallets.length === 0) {

    const strategyPreset = (appConfig as any)[chainKey]?.strategies?.['simple-dca-v1'];

    const addressesForChain = contractAddresses[chainKey];
    const usdc = addressesForChain.usdc;
    const cbBTC = addressesForChain.cbBTC || addressesForChain.wbtc || addressesForChain.weth; // risk asset preference
    const priceFeeds = [addressesForChain.btcUsdPriceFeed];
    // Read pool fee from unified config
    const fee = (appConfig as any)[chainKey]?.pools?.["USDC-cbBTC"]?.fee ?? 100;
    const poolFees = [fee];

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
        let maxFeePerGas: bigint | undefined;
        let maxPriorityFeePerGas: bigint | undefined;
        try {
          const fees = await feeClient.estimateFeesPerGas();
          maxFeePerGas = fees.maxFeePerGas;
          maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? parseUnits('1', 9);
        } catch {}
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
          ...(maxFeePerGas ? { maxFeePerGas } : {}),
          ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
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
                  {explorerBase ? (
                    <a href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
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

  const shortAddr =  address ? `${address?.slice(0, 6)}..${address?.slice(-4)}` : '';

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Your Portfolio</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Wallets owned by {shortAddr} 
      </Typography>

      <Grid container spacing={3}>
        {wallets.map((w) => (
          <Grid item xs={12} md={6} key={w}>
            <WalletSummaryCard walletAddress={w as `0x${string}`} />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

function WalletSummaryCard({ walletAddress }: { walletAddress: `0x${string}` }) {
  const powerWalletAbi = [
    { type: 'function', name: 'getPortfolioValueUSD', stateMutability: 'view', inputs: [], outputs: [ { name: 'usd6', type: 'uint256' } ] },
    { type: 'function', name: 'strategy', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'address' } ] },
  ] as const;
  const simpleDcaAbi = [
    { type: 'function', name: 'description', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'string' } ] },
    { type: 'function', name: 'dcaAmountStable', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
    { type: 'function', name: 'frequency', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  ] as const;

  const { data: valueUsd } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'getPortfolioValueUSD',
  });
  const { data: strategyAddr } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'strategy',
  });
  const { data: strategyDesc } = useReadContract({
    address: strategyAddr as `0x${string}` | undefined,
    abi: simpleDcaAbi as any,
    functionName: 'description',
    query: { enabled: Boolean(strategyAddr) },
  });
  const { data: dcaAmount } = useReadContract({
    address: strategyAddr as `0x${string}` | undefined,
    abi: simpleDcaAbi as any,
    functionName: 'dcaAmountStable',
    query: { enabled: Boolean(strategyAddr) },
  });
  const { data: freq } = useReadContract({
    address: strategyAddr as `0x${string}` | undefined,
    abi: simpleDcaAbi as any,
    functionName: 'frequency',
    query: { enabled: Boolean(strategyAddr) },
  });

  const formatUsd6 = (v?: bigint) => {
    if (!v) return '$0.00';
    const num = Number(v) / 1_000_000;
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const strategyName = 'Simple DCA';
  const shortAddr = `${walletAddress.slice(0, 6)}..${walletAddress.slice(-4)}`;
  const dcaAmountDisplay = (() => {
    const v = dcaAmount as bigint | undefined;
    if (!v) return '-';
    const num = Number(v) / 1_000_000; // USDC 6 decimals
    const str = num % 1 === 0 ? String(num) : num.toFixed(2);
    return `${str} USDC`;
  })();
  const freqDays = (() => {
    const f = freq as bigint | undefined;
    if (!f) return '-';
    const days = Math.round(Number(f) / 86400);
    return `${days}d`;
  })();

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ py: 1.5, px: 1.5 }}>
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Wallet Address</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
              {shortAddr}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Strategy</Typography>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
              {strategyName} - {dcaAmountDisplay} {freqDays}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Total Value</Typography>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
              {formatUsd6(valueUsd as bigint)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 0, pt: 2 }}>
            <Button size="small" variant="outlined" href={`/wallet?address=${walletAddress}`}>Open</Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}


