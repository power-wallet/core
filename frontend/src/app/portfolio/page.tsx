'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Container, Stack, Typography, ToggleButtonGroup, ToggleButton, TextField, Grid, Snackbar, Alert } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, useBalance } from 'wagmi';
import { encodeFunctionData, createPublicClient, http, parseUnits } from 'viem';
import { getViemChain, getChainKey } from '@/config/networks';
import { getFriendlyChainName, ensureOnPrimaryChain } from '@/lib/web3';
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
  const { isConnected, address, connector } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const chainName = useMemo(() => getFriendlyChainName(chainId) || 'this network', [chainId]);
  const [connectOpen, setConnectOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
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
      setShowCreate(false);
    }
  }, [isConfirmed, txHash]);

  const chainKey = useMemo(() => getChainKey(chainId), [chainId]);

  const explorerBase = (appConfig as any)[chainKey]?.explorer || '';

  const feeClient = useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http() }), [chainId]);

  const factoryAddress = contractAddresses[chainKey]?.walletFactory;
  const usdcAddress = contractAddresses[chainKey]?.usdc as `0x${string}` | undefined;

  // Balances for onboarding funding check
  const { data: nativeBal } = useBalance({ address: address as `0x${string}` | undefined, chainId });
  const erc20ReadAbi = [
    { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [ { name: 'account', type: 'address' } ], outputs: [ { name: '', type: 'uint256' } ] },
  ] as const;
  const { data: usdcBal } = useReadContract({
    address: usdcAddress,
    abi: erc20ReadAbi as any,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(usdcAddress && address) },
  });

  const { data: userWallets, isLoading, refetch: refetchWallets } = useReadContract({
    abi: walletFactoryAbi as any,
    address: factoryAddress as `0x${string}` | undefined,
    functionName: 'getUserWallets',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(isConnected && address && factoryAddress) },
  });

  // Normalize wallets and sort by createdAt (desc) for display
  const wallets = useMemo(() => (userWallets as string[] | undefined) || [], [userWallets]);
  const [sortedWallets, setSortedWallets] = useState<string[]>([]);

  // Fetch createdAt for each wallet and sort addresses by newest-first
  useEffect(() => {
    if (!wallets || wallets.length === 0) {
      setSortedWallets([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const abi = [
          { type: 'function', name: 'createdAt', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
        ] as const;
        const timestamps = await Promise.all(
          wallets.map((addr) =>
            feeClient
              .readContract({ address: addr as `0x${string}`, abi: abi as any, functionName: 'createdAt', args: [] })
              .catch(() => BigInt(0))
          )
        );
        const ordered = wallets
          .map((addr, i) => ({ addr, ts: Number((timestamps[i] as bigint | undefined) ?? BigInt(0)) }))
          .sort((a, b) => b.ts - a.ts)
          .map((x) => x.addr);
        if (!cancelled) setSortedWallets(ordered);
      } catch {
        if (!cancelled) setSortedWallets(wallets);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallets, feeClient]);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Container maxWidth="md" sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

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

  // duplicate block removed

  if (!factoryAddress) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Typography color="warning">Power Wallet is not available on {chainName}. Please switch to Base Sepolia Testnet.</Typography>
          <Button variant="contained" onClick={async () => {
            await ensureOnPrimaryChain(chainId, (args: any) => switchChainAsync(args as any));
          }}>
            Switch to Base Sepolia
          </Button>
        </Stack>
      </Container>
    );
  }

  if (wallets.length === 0 || showCreate) {

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
    const needsFunding = ((nativeBal?.value ?? BigInt(0)) === BigInt(0)) || ((usdcBal as bigint | undefined) === BigInt(0));
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" fontWeight="bold">Welcome to Power Wallet</Typography>
          {(showCreate || !needsFunding) ? (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  {wallets.length > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button size="small" onClick={() => setShowCreate(false)}>Cancel</Button>
                    </Box>
                  )}
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
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" fontWeight="bold">Fund your account</Typography>
                  <Typography variant="body2" color="text.secondary">
                    To get started, your connected wallet needs ETH (for gas) and USDC.
                  </Typography>
                  {chainKey === 'base-sepolia' ? (
                    <>
                      <Typography variant="body2" sx={{ pb: 1 }}>On Base Sepolia (testnet), use the following faucets:</Typography>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {[{
                          href: 'https://faucet.circle.com/',
                          label: 'Circle USDC Faucet',
                        }, {
                          href: 'https://faucets.chain.link/base-sepolia',
                          label: 'Chainlink Base Sepolia Faucet (ETH)',
                        }, {
                          href: 'https://faucet.quicknode.com/base/sepolia',
                          label: 'QuickNode Base Sepolia Faucet (ETH)',
                        }, {
                          href: 'https://www.alchemy.com/faucets/base-sepolia',
                          label: 'Alchemy Base Sepolia Faucet (ETH)',
                        }, {
                          href: 'https://portal.cdp.coinbase.com/products/faucet',
                          label: 'Coinbase Developer Faucet',
                        }].map((link) => (
                          <li key={link.href}>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                              <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{link.label}</a>
                              <LaunchIcon sx={{ fontSize: 14, color: 'inherit' }} />
                            </Box>
                          </li>
                        ))}
                      </ul>
                      {connector?.id === 'coinbaseWalletSDK' ? (
                        <Alert
                          severity="success"
                          icon={<InfoOutlinedIcon fontSize="small" />}
                          sx={{ mt: 1 }}
                        >
                          Using Coinbase Smart Wallet? You can continue without ETH: gas fees may be sponsored when creating your first Power Wallet. You will still need USDC later to deposit.
                        </Alert>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          You will need a small amount of ETH for gas to create your first Power Wallet.
                        </Typography>
                      )}
                      <Box>
                        <Button variant="contained" sx={{ mt: 1 }} onClick={() => setShowCreate(true)}>
                          Continue to Create Power Wallet
                        </Button>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Typography variant="body2">On Base mainnet, transfer some ETH and USDC to your address:</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {address ? `${address}` : ''}
                      </Typography>
                      {connector?.id === 'coinbaseWalletSDK' ? (
                        <Alert
                          severity="success"
                          icon={<InfoOutlinedIcon fontSize="small" />}
                          sx={{ mt: 1 }}
                        >
                          Using Coinbase Smart Wallet? You can continue without ETH: gas fees may be sponsored when creating your first Power Wallet. You will still need USDC later to deposit.
                        </Alert>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          You will need a small amount of ETH for gas to create your first Power Wallet.
                        </Typography>
                      )}
                      <Box>
                        <Button variant="contained" sx={{ mt: 1 }} onClick={() => setShowCreate(true)}>
                          Continue to Create Power Wallet
                        </Button>
                      </Box>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>Your Wallets</Typography>
        <Button variant="contained" size="small" onClick={() => setShowCreate(true)}>Create New Wallet</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Wallets owned by {shortAddr} 
      </Typography>

      <Grid container spacing={3}>
        {(sortedWallets.length ? sortedWallets : wallets).map((w) => (
          <Grid item xs={12} md={6} key={w}>
            <WalletSummaryCard walletAddress={w as `0x${string}`} explorerBase={explorerBase} feeClient={feeClient} />
          </Grid>
        ))}
      </Grid>

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
    </Container>
  );
}

function WalletSummaryCard({ walletAddress, explorerBase, feeClient }: { walletAddress: `0x${string}`; explorerBase: string; feeClient: any }) {
  const powerWalletAbi = [
    { type: 'function', name: 'getPortfolioValueUSD', stateMutability: 'view', inputs: [], outputs: [ { name: 'usd6', type: 'uint256' } ] },
    { type: 'function', name: 'strategy', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'address' } ] },
    { type: 'function', name: 'createdAt', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint64' } ] },
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
  const { data: createdAtTs } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'createdAt',
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
  const createdAt = createdAtTs ? new Date(Number(createdAtTs) * 1000).toLocaleDateString() : '';
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, justifyContent: 'flex-end', flex: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortAddr}</Typography>
              <a href={`${explorerBase}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" aria-label="Open on explorer" style={{ display: 'inline-flex', alignItems: 'center', color: 'inherit' }}>
                <LaunchIcon sx={{ fontSize: 14, color: 'inherit' }} />
              </a>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Total Value</Typography>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
              {formatUsd6(valueUsd as bigint)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Strategy</Typography>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
              {strategyName} - {dcaAmountDisplay} {freqDays}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>Created</Typography>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', flex: 1, minWidth: 0 }}>
              {createdAt}
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


