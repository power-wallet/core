'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, CircularProgress, Container, Stack, Typography, ToggleButtonGroup, ToggleButton, TextField, Grid, Snackbar, Alert, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, useBalance } from 'wagmi';
import { encodeFunctionData, createPublicClient, http, parseUnits } from 'viem';
import { getViemChain, getChainKey } from '@/config/networks';
import { getFriendlyChainName, ensureOnPrimaryChain } from '@/lib/web3';
import { baseSepolia } from 'wagmi/chains';
import WalletConnectModal from '@/components/WalletConnectModal';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import WalletSummaryCard from '@/app/wallet/WalletSummaryCard';
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

// Minimal read ABI for wallet summary aggregation
const walletViewAbi = [
  { type: 'function', name: 'getBalances', stateMutability: 'view', inputs: [], outputs: [ { name: 'stableBal', type: 'uint256' }, { name: 'riskBals', type: 'uint256[]' } ] },
  { type: 'function', name: 'getRiskAssets', stateMutability: 'view', inputs: [], outputs: [ { name: 'assets', type: 'address[]' } ] },
] as const;

const FEED_ABI = [
  { type: 'function', stateMutability: 'view', name: 'decimals', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
  { type: 'function', stateMutability: 'view', name: 'latestRoundData', inputs: [], outputs: [
    { name: 'roundId', type: 'uint80' },
    { name: 'answer', type: 'int256' },
    { name: 'startedAt', type: 'uint256' },
    { name: 'updatedAt', type: 'uint256' },
    { name: 'answeredInRound', type: 'uint80' },
  ] },
] as const;

export default function PortfolioPage() {
  const { isConnected, address, connector } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const chainName = useMemo(() => getFriendlyChainName(chainId) || 'this network', [chainId]);
  const [connectOpen, setConnectOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  // Onboarding params (must be top-level to preserve hooks order)
  const [amount, setAmount] = useState<string>('10');
  const [frequency, setFrequency] = useState<string>(String(60 * 60 * 24 * 7)); // 1 week in seconds (Simple DCA)
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('simple-btc-dca-v1');
  // Smart DCA params
  const [smartDays, setSmartDays] = useState<string>('7');
  const [smartBuyBps, setSmartBuyBps] = useState<number>(500); // 5%
  const [smartSmallBuyBps, setSmartSmallBuyBps] = useState<number>(100); // 1%
  const [smartSellBps, setSmartSellBps] = useState<number>(500); // 5%
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
  const assetCfg = (appConfig as any)[chainKey]?.assets as Record<string, { address: string; symbol: string; decimals: number; feed?: `0x${string}` }>;

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
  const [walletsReady, setWalletsReady] = useState(false);

  // Prices and aggregated totals across all wallets
  const [prices, setPrices] = useState<Record<string, { price: number; decimals: number }>>({});
  const [portfolioTotals, setPortfolioTotals] = useState<{ totalUsd: number; perAsset: Record<string, { amount: number; usd: number }> }>({ totalUsd: 0, perAsset: {} });

  // Filter out closed wallets, then fetch createdAt and sort newest-first
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWalletsReady(false);
      if (!wallets || wallets.length === 0) {
        if (!cancelled) {
          setSortedWallets([]);
          setWalletsReady(true);
        }
        return;
      }
      try {
        const isClosedAbi = [
          { type: 'function', name: 'isClosed', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
        ] as const;
        const statuses = await Promise.all(
          wallets.map((addr) =>
            feeClient
              .readContract({ address: addr as `0x${string}`, abi: isClosedAbi as any, functionName: 'isClosed', args: [] })
              .catch(() => false)
          )
        );
        const openWallets = wallets.filter((_, i) => statuses[i] === false);
        if (openWallets.length === 0) {
          if (!cancelled) {
            setSortedWallets([]);
            setWalletsReady(true);
          }
          return;
        }
        const createdAtAbi = [
          { type: 'function', name: 'createdAt', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
        ] as const;
        const timestamps = await Promise.all(
          openWallets.map((addr) =>
            feeClient
              .readContract({ address: addr as `0x${string}`, abi: createdAtAbi as any, functionName: 'createdAt', args: [] })
              .catch(() => BigInt(0))
          )
        );
        const ordered = openWallets
          .map((addr, i) => ({ addr, ts: Number((timestamps[i] as bigint | undefined) ?? BigInt(0)) }))
          .sort((a, b) => b.ts - a.ts)
          .map((x) => x.addr);
        if (!cancelled) setSortedWallets(ordered);
      } catch {
        if (!cancelled) setSortedWallets([]);
      } finally {
        if (!cancelled) setWalletsReady(true);
      }
    })();
    return () => { cancelled = true; };
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

  // Load prices for cbBTC, WETH, USDC when chain or config changes
  useEffect(() => {
    (async () => {
      try {
        const metas = ['cbBTC', 'WETH', 'USDC']
          .map((k) => (assetCfg as any)[k])
          .filter(Boolean) as { symbol: string; feed?: `0x${string}`; decimals: number }[];
        const next: Record<string, { price: number; decimals: number }> = {};
        for (const m of metas) {
          if (m.symbol === 'USDC') {
            next['USDC'] = { price: 1, decimals: 6 };
            continue;
          }
          const feed = m.feed as `0x${string}` | undefined;
          if (!feed) continue;
          const dec = await feeClient.readContract({ address: feed, abi: FEED_ABI as any, functionName: 'decimals', args: [] }) as number;
          const round = await feeClient.readContract({ address: feed, abi: FEED_ABI as any, functionName: 'latestRoundData', args: [] }) as any;
          const price = Number(round[1]) / 10 ** dec;
          next[m.symbol] = { price, decimals: dec };
        }
        setPrices(next);
      } catch {
        setPrices({});
      }
    })();
  }, [assetCfg, feeClient, chainKey]);

  // Aggregate portfolio across all open wallets
  useEffect(() => {
    (async () => {
      try {
        if (!walletsReady) return;
        const open = sortedWallets.length ? sortedWallets : wallets;
        if (!open.length) { setPortfolioTotals({ totalUsd: 0, perAsset: {} }); return; }
        const per: Record<string, { amount: number; usd: number }> = { cbBTC: { amount: 0, usd: 0 }, WETH: { amount: 0, usd: 0 }, USDC: { amount: 0, usd: 0 } };
        // Resolve symbols by address
        const byAddr: Record<string, string> = {};
        for (const key of Object.keys(assetCfg)) {
          byAddr[(assetCfg as any)[key].address.toLowerCase()] = key;
        }
        for (const w of open) {
          try {
            const [assets, balances] = await Promise.all([
              feeClient.readContract({ address: w as `0x${string}`, abi: walletViewAbi as any, functionName: 'getRiskAssets', args: [] }) as Promise<string[]>,
              feeClient.readContract({ address: w as `0x${string}`, abi: walletViewAbi as any, functionName: 'getBalances', args: [] }) as Promise<any>,
            ]);
            const stableBal: bigint = balances[0];
            const riskBals: bigint[] = balances[1];
            // USDC
            per.USDC.amount += Number(stableBal) / 1e6;
            per.USDC.usd += Number(stableBal) / 1e6;
            // Risks
            assets.forEach((addr: string, i: number) => {
              const sym = byAddr[addr.toLowerCase()];
              const amt = Number(riskBals[i] || BigInt(0));
              if (sym === 'cbBTC') {
                per.cbBTC.amount += amt / 1e8;
                per.cbBTC.usd += (amt / 1e8) * (prices.cbBTC?.price || 0);
              } else if (sym === 'WETH') {
                per.WETH.amount += amt / 1e18;
                per.WETH.usd += (amt / 1e18) * (prices.WETH?.price || 0);
              }
            });
          } catch {}
        }
        const totalUsd = per.cbBTC.usd + per.WETH.usd + per.USDC.usd;
        setPortfolioTotals({ totalUsd, perAsset: per });
      } catch {
        setPortfolioTotals({ totalUsd: 0, perAsset: {} });
      }
    })();
  }, [walletsReady, sortedWallets, wallets, prices, assetCfg, feeClient]);

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
            Connect a web3 wallet to view and manage your on-chain Power Wallets.
          </Typography>
          <Button variant="contained" onClick={() => setConnectOpen(true)}>Connect Wallet</Button>
        </Stack>
        <WalletConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      </Container>
    );
  }

  if (isLoading || !walletsReady) {
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

  // Common strategy/config values for create flow
  const strategiesMap = (appConfig as any)[chainKey]?.strategies || {};
  const strategyPreset = strategiesMap[selectedStrategyId] || (appConfig as any)[chainKey]?.strategies?.['simple-btc-dca-v1'];
    const addressesForChain = contractAddresses[chainKey];
    const usdc = addressesForChain.usdc;
    const cbBTC = addressesForChain.cbBTC || addressesForChain.wbtc || addressesForChain.weth; // risk asset preference
    const priceFeeds = [addressesForChain.btcUsdPriceFeed];
    const fee = (appConfig as any)[chainKey]?.pools?.["USDC-cbBTC"]?.fee ?? 100;
    const poolFees = [fee];
  const strategyIdBytes32 = strategyPreset?.idBytes32 as `0x${string}`;
  const initCalldata: `0x${string}` | null = (() => {
    if (selectedStrategyId === 'simple-btc-dca-v1') {
      return encodeFunctionData({
      abi: [
          { type: 'function', name: 'initialize', stateMutability: 'nonpayable', inputs: [
            { name: '_risk', type: 'address' },
            { name: '_stable', type: 'address' },
            { name: '_amountStable', type: 'uint256' },
            { name: '_frequency', type: 'uint256' },
            { name: 'desc', type: 'string' },
          ], outputs: [] },
        ],
        functionName: 'initialize',
        args: [cbBTC as `0x${string}`, usdc as `0x${string}`, BigInt(Math.max(0, Number(amount)) * 1_000_000), BigInt(Math.max(1, Number(frequency))), strategyPreset.description],
      }) as `0x${string}`;
    }
    if (selectedStrategyId === 'btc-dca-power-law-v1') {
      const freqSec = BigInt(Math.max(1, Number(smartDays)) * 86400);
      const lowerBps = 5000;
      const upperBps = 10000;
      const feed = addressesForChain.btcUsdPriceFeed as `0x${string}`;
      return encodeFunctionData({
        abi: [
          { type: 'function', name: 'initialize', stateMutability: 'nonpayable', inputs: [
            { name: '_risk', type: 'address' },
            { name: '_stable', type: 'address' },
            { name: '_feed', type: 'address' },
            { name: '_frequency', type: 'uint256' },
            { name: '_lowerBps', type: 'uint16' },
            { name: '_upperBps', type: 'uint16' },
            { name: '_buyBpsStable', type: 'uint16' },
            { name: '_smallBuyBpsStable', type: 'uint16' },
            { name: '_sellBpsRisk', type: 'uint16' },
            { name: 'desc', type: 'string' },
          ], outputs: [] },
      ],
      functionName: 'initialize',
        args: [
          cbBTC as `0x${string}`,
          usdc as `0x${string}`,
          feed,
          freqSec,
          lowerBps,
          upperBps,
          smartBuyBps,
          smartSmallBuyBps,
          smartSellBps,
          strategyPreset.description,
        ],
      }) as `0x${string}`;
    }
    return null;
  })();

    const onCreate = async () => {
    if (!factoryAddress || !cbBTC || !strategyIdBytes32 || !initCalldata) return;
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
        args: [strategyIdBytes32, initCalldata, usdc as `0x${string}`, [cbBTC as `0x${string}`], priceFeeds as [`0x${string}`], poolFees],
          ...(maxFeePerGas ? { maxFeePerGas } : {}),
          ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
        });
        setTxHash(hash as `0x${string}`);
      } finally {
        setCreating(false);
      }
    };

  // If user already has wallets and clicks create, show streamlined creation form without onboarding copy
  if (wallets.length > 0 && showCreate) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" fontWeight="bold">Create a New Power Wallet</Typography>
                  <Button size="small" onClick={() => setShowCreate(false)}>Cancel</Button>
                </Box>
                <Typography variant="subtitle1" fontWeight="bold">Select Strategy</Typography>
                <ToggleButtonGroup exclusive size="small" value={selectedStrategyId} onChange={(_, v) => v && setSelectedStrategyId(v)}>
                  <ToggleButton value="simple-btc-dca-v1">Simple BTC DCA</ToggleButton>
                  <ToggleButton value="btc-dca-power-law-v1">Smart BTC DCA</ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{strategyPreset?.description || ''}</Typography>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>Parameters</Typography>
                {selectedStrategyId === 'simple-btc-dca-v1' ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <TextField label="DCA amount (USDC)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} inputProps={{ min: 1 }} />
                    <Box>
                      <Typography variant="caption" display="block" sx={{ mb: 1 }}>Frequency</Typography>
                      <ToggleButtonGroup value={frequency} exclusive onChange={(_, val) => val && setFrequency(val)} size="small">
                        <ToggleButton value={String(60 * 60 * 24)}>1d</ToggleButton>
                        <ToggleButton value={String(60 * 60 * 24 * 3)}>3d</ToggleButton>
                        <ToggleButton value={String(60 * 60 * 24 * 5)}>5d</ToggleButton>
                        <ToggleButton value={String(60 * 60 * 24 * 7)}>1w</ToggleButton>
                        <ToggleButton value={String(60 * 60 * 24 * 14)}>2w</ToggleButton>
                        <ToggleButton value={String(60 * 60 * 24 * 30)}>1m</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </Stack>
                ) : (
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Box>
                        <Typography variant="caption" display="block">DCA Frequency (days)</Typography>
                        <TextField size="small" type="number" value={smartDays} onChange={(e) => setSmartDays(e.target.value)} inputProps={{ min: 1, max: 60, step: 1 }} sx={{ maxWidth: 160 }} />
                      </Box>
                      <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel id="small-buy-bps-label">Small Buy % (between lower and model)</InputLabel>
                        <Select labelId="small-buy-bps-label" label="Small Buy % (between lower and model)" value={smartSmallBuyBps} onChange={(e) => setSmartSmallBuyBps(Number(e.target.value))}>
                          {[50, 100, 150, 200, 500].map((v) => (<MenuItem key={v} value={v}>{(v/100).toFixed(2)}%</MenuItem>))}
                        </Select>
                      </FormControl>
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel id="buy-bps-label">Larger Buy % (below lower band)</InputLabel>
                        <Select labelId="buy-bps-label" label="Buy % (below lower band)" value={smartBuyBps} onChange={(e) => setSmartBuyBps(Number(e.target.value))}>
                          {[100, 200, 500, 1000, 2000, 5000].map((v) => (<MenuItem key={v} value={v}>{(v/100).toFixed(2)}%</MenuItem>))}
                        </Select>
                      </FormControl>
                      <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel id="sell-bps-label">Sell % (above upper band)</InputLabel>
                        <Select labelId="sell-bps-label" label="Sell % (above upper band)" value={smartSellBps} onChange={(e) => setSmartSellBps(Number(e.target.value))}>
                          {[100, 200, 500, 1000, 2000, 5000].map((v) => (<MenuItem key={v} value={v}>{(v/100).toFixed(2)}%</MenuItem>))}
                        </Select>
                      </FormControl>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">Below lower band uses Buy %; between lower band and model uses Small Buy %; above upper band uses Sell %.</Typography>
                  </Stack>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                  <Button variant="contained" disabled={creating || isConfirming} onClick={onCreate}>{creating || isConfirming ? 'Creating…' : 'Create Power Wallet'}</Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    );
  }

  if (walletsReady && sortedWallets.length === 0) {

    
    const needsFunding = ((nativeBal?.value ?? BigInt(0)) === BigInt(0)) || ((usdcBal as bigint | undefined) === BigInt(0));
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" fontWeight="bold">Welcome to Power Wallet</Typography>
          <Typography variant="body2" color="text.secondary">
            Create your first Power Wallet: an on-chain vault that can hold USDC and invest it into BTC according to a strategy you choose. 
            Your connected account will be the &quot;owner&quot; of the wallet &amp; strategy smart contracts, which means no one else can interact with them, and mess with your funds. 
          </Typography>
          {/* <Typography variant="body2" color="text.secondary">
            Now, select the strategy that will manage the assets in your Power Wallet.
          </Typography> */}
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
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={selectedStrategyId}
                    onChange={(_, v) => v && setSelectedStrategyId(v)}
                  >
                    <ToggleButton value="simple-btc-dca-v1">Simple BTC DCA</ToggleButton>
                    <ToggleButton value="btc-dca-power-law-v1">Smart BTC DCA</ToggleButton>
                  </ToggleButtonGroup>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {strategyPreset?.description || ''}
                  </Typography>

                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mt: 2 }}>Parameters</Typography>
                  {selectedStrategyId === 'simple-btc-dca-v1' ? (
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
                  ) : (
                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <Box>
                          <Typography variant="caption" display="block">DCA Frequency (days)</Typography>
                          <TextField size="small" type="number" value={smartDays} onChange={(e) => setSmartDays(e.target.value)} inputProps={{ min: 1, max: 60, step: 1 }} sx={{ maxWidth: 160 }} />
                        </Box>
                        <FormControl size="small" sx={{ minWidth: 260 }}>
                          <InputLabel id="small-buy-bps-label">Small Buy % (between lower and model)</InputLabel>
                          <Select labelId="small-buy-bps-label" label="Small Buy % (between lower and model)" value={smartSmallBuyBps} onChange={(e) => setSmartSmallBuyBps(Number(e.target.value))}>
                            {[50, 100, 150, 200, 500].map((v) => (<MenuItem key={v} value={v}>{(v/100).toFixed(2)}%</MenuItem>))}
                          </Select>
                        </FormControl>

                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 260 }}>
                          <InputLabel id="buy-bps-label">Larger Buy % (below lower band)</InputLabel>
                          <Select labelId="buy-bps-label" label="Buy % (below lower band)" value={smartBuyBps} onChange={(e) => setSmartBuyBps(Number(e.target.value))}>
                            {[100, 200, 500, 1000, 2000, 5000].map((v) => (<MenuItem key={v} value={v}>{(v/100).toFixed(2)}%</MenuItem>))}
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 260 }}>
                          <InputLabel id="sell-bps-label">Sell % (above upper band)</InputLabel>
                          <Select labelId="sell-bps-label" label="Sell % (above upper band)" value={smartSellBps} onChange={(e) => setSmartSellBps(Number(e.target.value))}>
                            {[100, 200, 500, 1000, 2000, 5000].map((v) => (<MenuItem key={v} value={v}>{(v/100).toFixed(2)}%</MenuItem>))}
                          </Select>
                        </FormControl>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Below lower band uses Buy %; between lower band and model uses Small Buy %; above upper band uses Sell %.
                      </Typography>
                    </Stack>
                  )}

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
                          Using Coinbase Smart Wallet? You can continue without ETH: gas fees are sponsored by Base. You will still need USDC later to fund your wallet.
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
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Portfolio Summary */}
      <Typography variant="h4" fontWeight="bold" gutterBottom>Portfolio Summary</Typography>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'stretch' }}>
            {/* Treemap-like rectangle */}
            <Box sx={{ flex: 1, minHeight: { xs: 60, sm: 120 }, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', display: 'flex' }}>
              {Object.entries(portfolioTotals.perAsset)
                .filter(([, v]) => v.usd > 0)
                .sort((a, b) => b[1].usd - a[1].usd)
                .map(([sym, v]) => {
                  const pct = portfolioTotals.totalUsd > 0 ? (v.usd / portfolioTotals.totalUsd) : 0;
                  const bg = sym === 'cbBTC' ? '#F59E0B' : (sym === 'WETH' ? '#9CA3AF' : '#10B981');
                  return (
                    <Box
                      key={sym}
                      sx={{ flex: pct, bgcolor: bg, minWidth: pct > 0 ? 2 : 0 }}
                      title={`${sym}: $${v.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                  );
                })}
            </Box>
            {/* Breakdown list */}
            <Box sx={{ flex: { xs: '1 1 auto', sm: '0 0 340px' }, display: 'flex', alignItems: 'stretch', mt: { xs: 0, sm: 0 } }}>
              <Stack spacing={0.75} sx={{ my: 0, alignSelf: 'stretch', justifyContent: 'flex-start' }}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                  {`Total Value: $${portfolioTotals.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </Typography>
                {Object.entries(portfolioTotals.perAsset)
                  .filter(([, v]) => v.usd > 0)
                  .sort((a, b) => b[1].usd - a[1].usd)
                  .map(([sym, v]) => (
                    <Typography key={sym} variant="body2">
                       {v.amount.toLocaleString('en-US', { maximumFractionDigits: sym === 'USDC' ? 2 : 8 })} {sym} — ${v.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Typography>
                  ))}
              </Stack>
            </Box>
          </Box>
        </CardContent>
      </Card>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>My Wallets</Typography>
        <Button variant="contained" size="small" onClick={() => setShowCreate(true)}>Create New Wallet</Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Power Wallets owned by {shortAddr} 
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
