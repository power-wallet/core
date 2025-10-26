'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Container, Stack, Typography, ToggleButtonGroup, ToggleButton, TextField, Grid, Snackbar, Alert, MenuItem, Select, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, useMediaQuery, useTheme, Tooltip } from '@mui/material';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain, useBalance } from 'wagmi';
import { encodeFunctionData, createPublicClient, http, parseUnits } from 'viem';
import { writeWithFees } from '@/lib/tx';
import { getViemChain, getChainKey } from '@/config/networks';
import { getFriendlyChainName, ensureOnPrimaryChain } from '@/lib/web3';
import WalletConnectModal from '@/components/WalletConnectModal';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import { walletFactoryAbi, walletViewAbi } from '@/lib/abi';
import WalletSummaryCard from '@/app/wallet/WalletSummaryCard';
import PortfolioSummary from '@/components/PortfolioSummary';
import CreateWalletDialog from '@/components/CreateWalletDialog';
import Onboarding from '@/components/Onboarding';
import { loadAssetPrices, loadAssetPricesFromBinance } from '@/lib/prices';
import appConfig from '@/config/appConfig.json';


export default function PortfolioPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isConnected, address, connector } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const chainName = useMemo(() => getFriendlyChainName(chainId) || 'this network', [chainId]);
  const [connectOpen, setConnectOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  // Onboarding params (must be top-level to preserve hooks order)
  const [amount, setAmount] = useState<string>('10');
  const [frequency, setFrequency] = useState<string>(String(60 * 60 * 24 * 7));
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
  const cfg = (appConfig as any)[chainKey];

  const feeClient = useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http(cfg?.rpcUrl) }), [chainId, cfg?.rpcUrl]);

  const factoryAddress = contractAddresses[chainKey]?.walletFactory;
  const usdcAddress = contractAddresses[chainKey]?.usdc as `0x${string}` | undefined;
  const assetCfg = (appConfig as any)[chainKey]?.assets as Record<string, { address: string; symbol: string; decimals: number; feed?: `0x${string}` }>;
  const addressesForChain = contractAddresses[chainKey];

  // Gentle RPC helpers: throttle and retry on 429
  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const readWithRetry = async <T,>(label: string, fn: () => Promise<T>, attempt = 0): Promise<T> => {
    try {
      return await fn();
    } catch (e: any) {
      console.log(`Error fetching ${label}: ${e}`);
      const msg = String(e?.message || e);
      const status = e?.status || e?.cause?.status;
      const is429 = status === 429 || msg.includes('429');
      const maxAttempts = 3;
      if (is429 || attempt < maxAttempts - 1) {
        const delay = is429 ? 2000 : 1000 + attempt * 500;
        console.warn(`[RPC] ${label} failed (attempt ${attempt + 1}). Retrying in ${delay}ms...`);
        await sleep(delay);
        return readWithRetry(label, fn, attempt + 1);
      }
      throw e;
    }
  };

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
  const [openWallets, setOpenWallets] = useState<string[]>([]);
  const [walletsReady, setWalletsReady] = useState(false);
  const [createdAtByAddr, setCreatedAtByAddr] = useState<Record<string, number>>({});
  const [walletValueUsdByAddr, setWalletValueUsdByAddr] = useState<Record<string, number>>({});
  const [sortKey, setSortKey] = useState<'value' | 'createdAt'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedKey = window.localStorage.getItem('portfolioSortKey');
        if (savedKey === 'value' || savedKey === 'createdAt') return savedKey;
      }
    } catch {}
    return 'createdAt';
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedDir = window.localStorage.getItem('portfolioSortDir');
        if (savedDir === 'asc' || savedDir === 'desc') return savedDir;
      }
    } catch {}
    return 'desc';
  });

  // Prices and aggregated totals across all wallets
  const [prices, setPrices] = useState<Record<string, { price: number; decimals: number }>>({});
  const [portfolioTotals, setPortfolioTotals] = useState<{ totalUsd: number; perAsset: Record<string, { amount: number; usd: number }> }>({ totalUsd: 0, perAsset: {} });

  // Fetch createdAt for wallets and sort newest-first
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWalletsReady(false);
      if (!wallets || wallets.length === 0) {
        if (!cancelled) {
          setOpenWallets([]);
          setCreatedAtByAddr({});
          setWalletsReady(true);
        }
        return;
      }
      try {
        const createdAtAbi = [
          { type: 'function', name: 'createdAt', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint64' }] },
        ] as const;
        // Sequential, gentle fetching with retry and short pacing
        const timestamps: (bigint | undefined)[] = [];
        for (const addr of wallets) {
          const ts = await readWithRetry<bigint>(
            `createdAt:${addr}`,
            () => feeClient.readContract({ address: addr as `0x${string}`, abi: createdAtAbi as any, functionName: 'createdAt', args: [] }) as Promise<bigint>
          ).catch(() => BigInt(0));
          timestamps.push(ts);
          await sleep(1000);
        }
        const pairs = wallets.map((addr, i) => ({ addr, ts: Number((timestamps[i] as bigint | undefined) ?? BigInt(0)) }));
        const ordered = pairs
          .slice()
          .sort((a, b) => b.ts - a.ts)
          .map((x) => x.addr);
        if (!cancelled) {
          setOpenWallets(ordered);
          const map: Record<string, number> = {};
          for (const p of pairs) map[p.addr] = p.ts;
          setCreatedAtByAddr(map);
        }
      } catch {
        if (!cancelled) {
          setOpenWallets([]);
          setCreatedAtByAddr({});
        }
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

  // Load prices for cbBTC, WETH, USDC when chain or config changes (use Binance first, then retry Chainlink until cbBTC is available)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const metas = ['cbBTC', 'WETH', 'USDC']
        .map((k) => (assetCfg as any)[k])
        .filter(Boolean) as { symbol: string; feed?: `0x${string}`; decimals: number }[];
      let attempt = 0;
      // First try Binance as a quick off-chain source to avoid RPC throttling delays
      try {
        const binance = await loadAssetPricesFromBinance(metas.map(m => ({ symbol: m.symbol })));
        const cbOk = Number.isFinite(binance?.cbBTC?.price) && (binance?.cbBTC?.price || 0) > 0;
        if (cbOk) {
          if (!cancelled) setPrices(binance);
          return;
        }
      } catch {}
      // Fallback: retry Chainlink until cbBTC arrives
      for (;;) {
        if (cancelled) break;
        try {
          const next = await loadAssetPrices(chainId, metas);
          const needsCb = metas.some(m => m.symbol === 'cbBTC');
          const hasCbPrice = !needsCb || (Number.isFinite(next?.cbBTC?.price) && (next?.cbBTC?.price || 0) > 0);
          if (hasCbPrice) {
            if (!cancelled) setPrices(next);
            break;
          }
        } catch {}
        attempt += 1;
        const delay = Math.min(15000, 1000 * Math.pow(2, Math.min(attempt, 4)));
        await sleep(delay);
      }
    })();
    return () => { cancelled = true; };
  }, [assetCfg, chainId]);

  // Aggregate portfolio across all open wallets and compute per-wallet value
  useEffect(() => {
    (async () => {
      try {
        if (!walletsReady) return;
        const open = openWallets.length ? openWallets : wallets;
        if (!open.length) { setPortfolioTotals({ totalUsd: 0, perAsset: {} }); return; }
        const per: Record<string, { amount: number; usd: number }> = { cbBTC: { amount: 0, usd: 0 }, WETH: { amount: 0, usd: 0 }, USDC: { amount: 0, usd: 0 } };
        const valueByAddr: Record<string, number> = {};
        // Resolve symbols by address
        const byAddr: Record<string, string> = {};
        for (const key of Object.keys(assetCfg)) {
          byAddr[(assetCfg as any)[key].address.toLowerCase()] = key;
        }
        for (const w of open) {
          try {
            // Sequential per-wallet calls with retry, small pacing
            const assets = await readWithRetry<string[]>(
              `getRiskAssets:${w}`,
              () => feeClient.readContract({ address: w as `0x${string}`, abi: walletViewAbi as any, functionName: 'getRiskAssets', args: [] }) as Promise<string[]>
            );
            await sleep(1000);
            const balances = await readWithRetry<any>(
              `getBalances:${w}`,
              () => feeClient.readContract({ address: w as `0x${string}`, abi: walletViewAbi as any, functionName: 'getBalances', args: [] }) as Promise<any>
            );
            const stableBal: bigint = balances[0];
            const riskBals: bigint[] = balances[1];
            // USDC
            per.USDC.amount += Number(stableBal) / 1e6;
            per.USDC.usd += Number(stableBal) / 1e6;
            let walletUsd = Number(stableBal) / 1e6;
            // Risks
            assets.forEach((addr: string, i: number) => {
              const sym = byAddr[addr.toLowerCase()];
              const amt = Number(riskBals[i] || BigInt(0));
              if (sym === 'cbBTC') {
                const tokenDec = (assetCfg as any).cbBTC?.decimals ?? 8;
                const priceNum = prices.cbBTC?.price;
                const amtHuman = amt / 10 ** tokenDec;
                per.cbBTC.amount += amtHuman;
                if (priceNum !== undefined) {
                  const usdVal = amtHuman * priceNum;
                  per.cbBTC.usd += usdVal;
                  walletUsd += usdVal;
                }
              } else if (sym === 'WETH') {
                const tokenDec = (assetCfg as any).WETH?.decimals ?? 18;
                const priceNum = prices.WETH?.price;
                const amtHuman = amt / 10 ** tokenDec;
                per.WETH.amount += amtHuman;
                if (priceNum !== undefined) {
                  const usdVal = amtHuman * priceNum;
                  per.WETH.usd += usdVal;
                  walletUsd += usdVal;
                }
              }
            });
            valueByAddr[w] = walletUsd;
            await sleep(1000);
          } catch (e: any) {
            console.log(`Error fetching portfolio for wallet ${w}: ${e}`);
          }
        }
        const totalUsd = per.cbBTC.usd + per.WETH.usd + per.USDC.usd;
        setPortfolioTotals({ totalUsd, perAsset: per });
        setWalletValueUsdByAddr(valueByAddr);
        setPortfolioTotals({ totalUsd, perAsset: per });
        console.log('setPortfolioTotals:', totalUsd, "perAsset:", per);
      } catch {
        setPortfolioTotals({ totalUsd: 0, perAsset: {} });
        setWalletValueUsdByAddr({});
      }
    })();
  }, [walletsReady, openWallets, wallets, prices, assetCfg, feeClient]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Persist sort preferences when they change
  useEffect(() => {
    try {
      window.localStorage.setItem('portfolioSortKey', sortKey);
      window.localStorage.setItem('portfolioSortDir', sortDir);
    } catch {}
  }, [sortKey, sortDir]);

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
          <Typography variant="h4" fontWeight="bold">
            Connect your wallet
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Connect a web3 wallet to view and manage your on-chain Power Wallets.
          </Typography>
          <Button variant="contained" startIcon={<AccountBalanceWalletIcon />} onClick={() => setConnectOpen(true)}>
            Connect Wallet
          </Button>
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
          <Typography color="text.primary">
            Power Wallet is not available on {chainName}. 
            <br />
            Please switch to Base Sepolia Testnet.
          </Typography>
          <Button variant="contained" startIcon={<SwapHorizIcon fontSize="small" />} onClick={async () => {
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
  const usdc = addressesForChain.usdc;
  const cbBTC = addressesForChain.cbBTC || addressesForChain.wbtc || addressesForChain.weth; // risk asset preference
  const priceFeeds = [addressesForChain.btcUsdPriceFeed];
  const fee = (appConfig as any)[chainKey]?.pools?.["USDC-cbBTC"]?.fee ?? 100;
  const poolFees = [fee];

  // TODO thi strategy init loogic should be extracted to separate files and associated with the strategy id
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
    if (selectedStrategyId === 'power-btc-dca-v2') {
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
    if (selectedStrategyId === 'smart-btc-dca-v2') {
      const freqSec = BigInt(Math.max(1, Number(frequency)));
      const feed = addressesForChain.btcUsdPriceFeed as `0x${string}`;
      const indicators = (addressesForChain as any)?.technicalIndicators as `0x${string}` | undefined;
      const baseDcaStable = BigInt(Math.max(0, Number(amount)) * 1_000_000);
      const targetBps = 8000;     // 80% target BTC weight (8000 bps)
      const bandDeltaBps = 1000;  // ±10% band around target
      const bufferMultX = 9;      // days of base DCA to keep as USDC buffer
      const cmaxMultX = 3;        // cap extra buy per day = cmax_mult * base_dca
      const rebalanceCapBps = 500;// 5% cap single rebalance to 5% NAV
      const kKicker1e6 = 50_000;  // 0.05 vol/drawdown sizing coefficient
      const thresholdMode = true; // optional true threshold rebalancing
      return encodeFunctionData({
        abi: [
          { type: 'function', name: 'initialize', stateMutability: 'nonpayable', inputs: [
            { name: '_risk', type: 'address' },
            { name: '_stable', type: 'address' },
            { name: '_feed', type: 'address' },
            { name: '_indicators', type: 'address' },
            { name: '_baseDcaStable', type: 'uint256' },
            { name: '_frequency', type: 'uint256' },
            { name: '_targetBps', type: 'uint16' },
            { name: '_bandDeltaBps', type: 'uint16' },
            { name: '_bufferMultX', type: 'uint16' },
            { name: '_cmaxMultX', type: 'uint16' },
            { name: '_rebalanceCapBps', type: 'uint16' },
            { name: '_kKicker1e6', type: 'uint32' },
            { name: '_thresholdMode', type: 'bool' },
            { name: 'desc', type: 'string' },
          ], outputs: [] },
        ],
        functionName: 'initialize',
        args: [
          cbBTC as `0x${string}`,
          usdc as `0x${string}`,
          feed,
          (indicators || '0x0000000000000000000000000000000000000000') as `0x${string}`,
          baseDcaStable,
          freqSec,
          targetBps,
          bandDeltaBps,
          bufferMultX,
          cmaxMultX,
          rebalanceCapBps,
          kKicker1e6,
          thresholdMode,
          strategyPreset.description,
        ],
      }) as `0x${string}`;
    }
    if (selectedStrategyId === 'trend-btc-dca-v1') {
      const feed = addressesForChain.btcUsdPriceFeed as `0x${string}`;
      const indicators = (addressesForChain as any)?.technicalIndicators as `0x${string}` | undefined;
      const freqSec = 5n * 24n * 3600n; // 5 days
      const smaLen = 50;                // SMA50
      const hystBps = 150;              // 1.5%
      const slopeLookbackDays = 14;     // 14 days
      const dcaPctBps = 500;            // 5%
      const discountBelowSmaPct = 15;   // 15%
      const dcaBoostMultiplier = 2;     // 2x
      const minCashStable = 1n * 1_000_000n; // $1 in 6d
      const minSpendStable = 1n * 1_000_000n;  // $1 in 6d
      return encodeFunctionData({
        abi: [
          { type: 'function', name: 'initialize', stateMutability: 'nonpayable', inputs: [
            { name: '_risk', type: 'address' },
            { name: '_stable', type: 'address' },
            { name: '_btcFeed', type: 'address' },
            { name: '_indicators', type: 'address' },
            { name: '_frequency', type: 'uint256' },
            { name: '_smaLen', type: 'uint16' },
            { name: '_hystBps', type: 'uint16' },
            { name: '_slopeLookbackDays', type: 'uint16' },
            { name: '_dcaPctBps', type: 'uint16' },
            { name: '_discountBelowSmaPct', type: 'uint16' },
            { name: '_dcaBoostMultiplier', type: 'uint16' },
            { name: '_minCashStable', type: 'uint256' },
            { name: '_minSpendStable', type: 'uint256' },
            { name: 'desc', type: 'string' },
          ], outputs: [] },
        ],
        functionName: 'initialize',
        args: [
          cbBTC as `0x${string}`,
          usdc as `0x${string}`,
          feed,
          (indicators || '0x0000000000000000000000000000000000000000') as `0x${string}`,
          freqSec,
          smaLen,
          hystBps,
          slopeLookbackDays,
          dcaPctBps,
          discountBelowSmaPct,
          dcaBoostMultiplier,
          minCashStable,
          minSpendStable,
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
      const hash = await writeWithFees({
        write: writeContractAsync as any,
        client: feeClient as any,
        address: factoryAddress as `0x${string}`,
        abi: walletFactoryAbi as any,
        functionName: 'createWallet',
        args: [strategyIdBytes32, initCalldata, usdc as `0x${string}`, [cbBTC as `0x${string}`], priceFeeds as [`0x${string}`], poolFees],
      });
      setTxHash(hash as `0x${string}`);
    } finally {
      setCreating(false);
    }
  };

  // If user already has wallets and clicks create, show streamlined creation form as a dialog
  if (wallets.length > 0 && showCreate) {
    return (
      <CreateWalletDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={onCreate}
        creating={creating}
        isConfirming={isConfirming}
        selectedStrategyId={selectedStrategyId}
        onChangeStrategy={setSelectedStrategyId}
        description={strategyPreset?.description || ''}
        amount={amount}
        onChangeAmount={setAmount}
        frequency={frequency}
        onChangeFrequency={setFrequency}
        smartDays={smartDays}
        onChangeSmartDays={setSmartDays}
      />
    );
  }

  if (walletsReady && (openWallets.length === 0)) {
    if (showCreate) {
      return (
        <CreateWalletDialog
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreate={onCreate}
          creating={creating}
          isConfirming={isConfirming}
          selectedStrategyId={selectedStrategyId}
          onChangeStrategy={setSelectedStrategyId}
          description={strategyPreset?.description || ''}
          amount={amount}
          onChangeAmount={setAmount}
          frequency={frequency}
          onChangeFrequency={setFrequency}
          smartDays={smartDays}
          onChangeSmartDays={setSmartDays}
        />
      );
    }
    const needsFunding = ((nativeBal?.value ?? BigInt(0)) === BigInt(0)) || ((usdcBal as bigint | undefined) === BigInt(0));
    return (
      <Onboarding
        isBaseSepolia={chainKey === 'base-sepolia'}
        address={address as `0x${string}` | undefined}
        connectorId={connector?.id}
        needsFunding={needsFunding}
        onOpenCreate={() => setShowCreate(true)}
      />
    );
  }

  const shortAddr =  address ? `${address?.slice(0, 6)}..${address?.slice(-4)}` : '';

  const displayWallets = (() => {
    const list = (openWallets.length ? openWallets : wallets).slice();
    list.sort((a, b) => {
      if (sortKey === 'value') {
        const va = walletValueUsdByAddr[a] ?? 0;
        const vb = walletValueUsdByAddr[b] ?? 0;
        return sortDir === 'asc' ? va - vb : vb - va;
      } else {
        const ta = createdAtByAddr[a] ?? 0;
        const tb = createdAtByAddr[b] ?? 0;
        return sortDir === 'asc' ? ta - tb : tb - ta;
      }
    });
    return list;
  })();

  const onSortClick = (key: 'value' | 'createdAt') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  console.log('portfolioTotals', portfolioTotals);

  const hideSummary = (() => {
    try {
      const amt = Number((portfolioTotals.perAsset as any)?.cbBTC?.amount || -1);
      const priceLoaded = Number.isFinite(prices?.cbBTC?.price) && (prices?.cbBTC?.price || 0) > 0;
      return amt > 0 && !priceLoaded;
    } catch { return true; }
  })();

  const walletCountForSort = (openWallets.length ? openWallets.length : wallets.length);

  return (
  <Box sx={{ bgcolor: 'background.default', minHeight: '60vh' }}>

    <Container maxWidth="lg" sx={{ py: 3 }} >
      {/* Portfolio Summary */}
      {portfolioTotals.totalUsd > 0 && !hideSummary ? (
        <>
          <Typography variant="h4" fontWeight="bold" gutterBottom>Portfolio Summary</Typography>
          <PortfolioSummary totalUsd={portfolioTotals.totalUsd} perAsset={portfolioTotals.perAsset} />
        </>
      ) : null}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>My Wallets</Typography>
        <Button variant="contained" size="small" onClick={() => setShowCreate(true)}>Create New Wallet</Button>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Power Wallets owned by {shortAddr}
        </Typography>
        {walletCountForSort > 1 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={`Sort by value`}>
            <IconButton size="small" color={sortKey === 'value' ? 'primary' : 'default'} onClick={() => onSortClick('value')} aria-label="Sort by value">
              <MonetizationOnOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" aria-label="Toggle sort direction" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
            {sortDir === 'desc' ? <ArrowDownwardIcon fontSize="small" color="primary" /> : <ArrowUpwardIcon fontSize="small" color="primary" />}
          </IconButton>
          <Tooltip title={`Sort by created date`}>
            <IconButton size="small" color={sortKey === 'createdAt' ? 'primary' : 'default'} onClick={() => onSortClick('createdAt')} aria-label="Sort by created date">
              <CalendarTodayOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        ) : null}
      </Box>

      <Grid container spacing={3}>
        {displayWallets.map((w) => (
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
  </Box>
  );
}
