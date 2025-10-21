'use client';

import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Grid, Stack, TextField, Typography, Link as MuiLink, Snackbar, Alert, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import { createPublicClient, http, parseUnits } from 'viem';
import { getChainKey, getViemChain } from '@/config/networks';
import appConfig from '@/config/appConfig.json';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { ensureOnPrimaryChain, getFriendlyChainName } from '@/lib/web3';

const POOL_ABI = [
  { type: 'function', name: 'slot0', stateMutability: 'view', inputs: [], outputs: [
    { name: 'sqrtPriceX96', type: 'uint160' },
    { name: 'tick', type: 'int24' },
    { name: 'observationIndex', type: 'uint16' },
    { name: 'observationCardinality', type: 'uint16' },
    { name: 'observationCardinalityNext', type: 'uint16' },
    { name: 'feeProtocol', type: 'uint8' },
    { name: 'unlocked', type: 'bool' },
  ] },
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'liquidity', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint128' }] },
  { type: 'function', name: 'fee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint24' }] },
] as const;

const ERC20_ABI = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const FEED_ABI = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [], outputs: [
    { name: 'roundId', type: 'uint80' },
    { name: 'answer', type: 'int256' },
    { name: 'startedAt', type: 'uint256' },
    { name: 'updatedAt', type: 'uint256' },
    { name: 'answeredInRound', type: 'uint80' },
  ] },
] as const;

// QuoterV2 ABI used for price/amount quoting
const QUOTER_ABI = [
  { type: 'function', name: 'quoteExactInputSingle', stateMutability: 'view', inputs: [
    { name: 'params', type: 'tuple', components: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'fee', type: 'uint24' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ] }
  ], outputs: [ { type: 'uint256' }, { type: 'uint160' } ] },
] as const;

function formatNumber(n: number, maxFrac = 6) {
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
}

export default function Client() {
  const sp = useSearchParams();
  const poolAddress = (sp.get('address') || '') as `0x${string}`;
  const shortAddr = useMemo(() => (poolAddress ? `${poolAddress.slice(0, 6)}...${poolAddress.slice(-4)}` : ''), [poolAddress]);
  const chainId = useChainId();
  const chainKey = useMemo(() => getChainKey(chainId), [chainId]);
  const cfg = (appConfig as any)[chainKey];
  const client = useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http(cfg?.rpcUrl, { batch: true }) }), [chainId, cfg?.rpcUrl]);
  const ADDR = contractAddresses[chainKey];
  const explorerBase = cfg?.explorer as string | undefined;
  const { isConnected, address: account } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [toastOpen, setToastOpen] = useState(false);
  const [lastTx, setLastTx] = useState<`0x${string}` | undefined>(undefined);
  const [token0, setToken0] = useState<string>('');
  const [token1, setToken1] = useState<string>('');
  const [dec0, setDec0] = useState<number>(18);
  const [dec1, setDec1] = useState<number>(18);
  const [sym0, setSym0] = useState<string>('');
  const [sym1, setSym1] = useState<string>('');
  const [sqrtPriceX96, setSqrtPriceX96] = useState<bigint | null>(null);
  const [tick, setTick] = useState<number | null>(null);
  const [liquidity, setLiquidity] = useState<bigint | null>(null);
  const [bal0, setBal0] = useState<bigint | null>(null);
  const [bal1, setBal1] = useState<bigint | null>(null);
  const [oracleStablePerRisk, setOracleStablePerRisk] = useState<number | null>(null);
  const [usdPerToken0, setUsdPerToken0] = useState<number | null>(null);
  const [usdPerToken1, setUsdPerToken1] = useState<number | null>(null);
  const [wrapAmount, setWrapAmount] = useState<string>('');
  const [unwrapAmount, setUnwrapAmount] = useState<string>('');
  const [usdcLiquidity, setUsdcLiquidity] = useState<string>('');
  const [isWorking, setIsWorking] = useState(false);
  const [fee, setFee] = useState<number | null>(null);
  const [userUsdcBal, setUserUsdcBal] = useState<bigint | null>(null);
  const [userRiskBal, setUserRiskBal] = useState<bigint | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const oracleLastFetchRef = useRef<number>(0);

  // Slippage simulator state
  const [simTokenIn, setSimTokenIn] = useState<'token0' | 'token1'>('token0');
  const [simAmount, setSimAmount] = useState<string>('');
  const [simWorking, setSimWorking] = useState(false);
  const [simResult, setSimResult] = useState<{ amountOut: number; usdIn: number; usdOut: number; slippagePct: number } | null>(null);

  const ensureChain = async () => {
    const ok = await ensureOnPrimaryChain(chainId, (args: any) => switchChainAsync(args as any));
    if (!ok) throw new Error('Please switch to Base Sepolia');
  };

  // Prefer configured pool fee from appConfig when available (per-network)
  const configuredPoolFee: number | null = useMemo(() => {
    const pools = (cfg?.pools || {}) as any;
    const usdc = (ADDR?.usdc || '').toLowerCase();
    const cbBtc = (ADDR?.cbBTC || '').toLowerCase();
    const weth = (ADDR?.weth || '').toLowerCase();
    const t0 = (token0 || '').toLowerCase();
    const t1 = (token1 || '').toLowerCase();
    const isUsdcCbBtc = (t0 === usdc && t1 === cbBtc) || (t0 === cbBtc && t1 === usdc);
    const isUsdcWeth = (t0 === usdc && t1 === weth) || (t0 === weth && t1 === usdc);
    if (isUsdcCbBtc) return Number(pools['USDC-cbBTC']?.fee || 0) || null;
    if (isUsdcWeth) return Number(pools['USDC-WETH']?.fee || 0) || null;
    return null;
  }, [cfg?.pools, ADDR?.usdc, ADDR?.cbBTC, ADDR?.weth, token0, token1]);

  useEffect(() => {
    (async () => {
      if (!poolAddress) {
        console.log('[Pool] skip: no pool address');
        return;
      }
      
      try {
        const [slot0, t0, t1] = await Promise.all([
          client.readContract({ address: poolAddress, abi: POOL_ABI as any, functionName: 'slot0', args: [] }) as Promise<any>,
          client.readContract({ address: poolAddress, abi: POOL_ABI as any, functionName: 'token0', args: [] }) as Promise<`0x${string}`>,
          client.readContract({ address: poolAddress, abi: POOL_ABI as any, functionName: 'token1', args: [] }) as Promise<`0x${string}`>,
        ]);
        console.log('[Pool] slot0 sqrtPriceX96 raw:', String(slot0[0]), 'tick:', Number(slot0[1]));
        setSqrtPriceX96(BigInt(slot0[0]));
        setTick(Number(slot0[1]));
        setToken0(t0); setToken1(t1);
        console.log('[Pool] token0, token1 addresses:', t0, t1);
        // Use appConfig for token metadata when available to avoid RPC calls
        const assets = (cfg?.assets || {}) as any;
        const metaFor = (addr: string) => {
          const entries = Object.values(assets) as any[];
          for (const e of entries) {
            if ((e?.address || '').toLowerCase() === (addr || '').toLowerCase()) {
              return { dec: Number(e?.decimals), sym: String(e?.symbol || '') };
            }
          }
          return { dec: undefined as number | undefined, sym: '' };
        };
        const m0 = metaFor(t0 as string);
        const m1 = metaFor(t1 as string);
        if (m0.dec !== undefined) setDec0(m0.dec);
        if (m1.dec !== undefined) setDec1(m1.dec);
        if (m0.sym) setSym0(m0.sym);
        if (m1.sym) setSym1(m1.sym);
        console.log('[Pool] token0/token1 decimals, symbols (cfg):', m0.dec, m1.dec, m0.sym, m1.sym);

        try {
          // Use configured fee (from appConfig) to avoid RPC call
          if (configuredPoolFee !== null) {
            setFee(configuredPoolFee);
            console.log('[Pool] fee configured:', configuredPoolFee);
          }

          // Liquidity and Balances – add retry with backoff (3s + 1s per attempt, up to 10 attempts)
          let canceledFetches = false;
          let liqTimeout: any = null;
          let bal0Timeout: any = null;
          let bal1Timeout: any = null;

          const fetchLiquidity = async (attempt: number) => {
            if (canceledFetches) return;
            try {
              const liq = await client.readContract({ address: poolAddress, abi: POOL_ABI as any, functionName: 'liquidity', args: [] }) as bigint;
              setLiquidity(liq);
              console.log('[Pool] liquidity raw:', liq.toString());
            } catch (e) {
              if (attempt < 10 && !canceledFetches) {
                const delay = 3000 + attempt * 1000;
                console.log('[Pool] liquidity retry in ms', delay);
                liqTimeout = setTimeout(() => fetchLiquidity(attempt + 1), delay);
              } else {
                console.warn('[Pool] liquidity read failed after retries');
              }
            }
          };
          liqTimeout = setTimeout(() => fetchLiquidity(0), 400);

          // Only fetch token metadata if missing from config
          if (m0.dec === undefined) {
            const d0 = await client.readContract({ address: t0, abi: ERC20_ABI as any, functionName: 'decimals', args: [] }) as number;
            setDec0(d0);
          }
          if (m1.dec === undefined) {
            const d1 = await client.readContract({ address: t1, abi: ERC20_ABI as any, functionName: 'decimals', args: [] }) as number;
            setDec1(d1);
          }
          if (!m0.sym) {
            const s0 = await client.readContract({ address: t0, abi: ERC20_ABI as any, functionName: 'symbol', args: [] }) as string;
            setSym0(s0);
          }
          if (!m1.sym) {
            const s1 = await client.readContract({ address: t1, abi: ERC20_ABI as any, functionName: 'symbol', args: [] }) as string;
            setSym1(s1);
          }

          // Balances (with retry)
          const fetchBalanceWithRetry = (
            addr: `0x${string}`,
            setFn: (v: bigint) => void,
            label: string,
            attempt: number
          ) => {
            if (canceledFetches) return;
            client.readContract({ address: addr, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [poolAddress] })
              .then((v) => {
                if (canceledFetches) return;
                const b = v as bigint;
                console.log(`[Pool] balance ${label} raw:`, b.toString());
                setFn(b);
              })
              .catch(() => {
                if (attempt < 10 && !canceledFetches) {
                  const delay = 3000 + attempt * 1000;
                  console.log(`[Pool] balance ${label} retry in ms`, delay);
                  const to = setTimeout(() => fetchBalanceWithRetry(addr, setFn, label, attempt + 1), delay);
                  if (label === 'token0') bal0Timeout = to; else bal1Timeout = to;
                } else if (!canceledFetches) {
                  console.warn(`[Pool] balance ${label} read failed after retries`);
                }
              });
          };
          bal0Timeout = setTimeout(() => fetchBalanceWithRetry(t0, setBal0, 'token0', 0), 300);
          bal1Timeout = setTimeout(() => fetchBalanceWithRetry(t1, setBal1, 'token1', 0), 700);

          // Cleanup timers when effect re-runs
          setTimeout(() => {
            // attach to outer cleanup via scope variable
          }, 0);
        } catch (e) {
          console.error('[Pool] metadata read error:', e);
        }
      } catch {}
    })();
  }, [poolAddress, client, configuredPoolFee]);

  const priceToken1PerToken0 = useMemo(() => {
    // Prefer tick-based formula for readability and to avoid floating drift
    if (tick === null) return 0;
    const priceFromTick = Math.pow(1.0001, tick);
    // token1 per token0 with decimal adjustment: 10^(dec0 - dec1)
    return priceFromTick * Math.pow(10, dec0 - dec1);
  }, [tick, dec0, dec1]);

  const bal0Human = useMemo(() => bal0 !== null ? Number(bal0) / Math.pow(10, dec0) : 0, [bal0, dec0]);
  const bal1Human = useMemo(() => bal1 !== null ? Number(bal1) / Math.pow(10, dec1) : 0, [bal1, dec1]);

  const stableIsToken0 = useMemo(() => token0 && ADDR?.usdc && token0.toLowerCase() === ADDR.usdc.toLowerCase(), [token0, ADDR?.usdc]);
  const stableIsToken1 = useMemo(() => token1 && ADDR?.usdc && token1.toLowerCase() === ADDR.usdc.toLowerCase(), [token1, ADDR?.usdc]);
  const riskSymbol = useMemo(() => {
    if (stableIsToken0) return sym1;
    if (stableIsToken1) return sym0;
    return '';
  }, [stableIsToken0, stableIsToken1, sym0, sym1]);
  const poolStablePerRisk = useMemo(() => {
    if (!token0 || !token1) return 0;
    if (stableIsToken0) return priceToken1PerToken0 === 0 ? 0 : (1 / priceToken1PerToken0);
    if (stableIsToken1) return priceToken1PerToken0;
    return 0;
  }, [stableIsToken0, stableIsToken1, priceToken1PerToken0, token0, token1]);


  // Load user balances (USDC and risk asset)
  useEffect(() => {
    (async () => {
      try {
        if (!isConnected || !ADDR?.usdc || !account) return;
        const usdcBal = await client.readContract({ address: ADDR.usdc as `0x${string}`, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [account as `0x${string}`] }) as bigint;
        setUserUsdcBal(usdcBal);
      } catch {}
      try {
        if (!isConnected || !account) return;
        const riskAddr = stableIsToken0 ? token1 : token0;
        if (!riskAddr) return;
        const riskBal = await client.readContract({ address: riskAddr as `0x${string}`, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [account as `0x${string}`] }) as bigint;
        setUserRiskBal(riskBal);
      } catch {}
    })();
  }, [isConnected, account, ADDR?.usdc, client, token0, token1, stableIsToken0]);

  useEffect(() => {
    (async () => {
      console.log('[Oracle] effect start');
      // Require token addresses and feeds
      if (!token0 || !token1) {
        console.log('[Oracle] skip: token addresses not ready', { token0, token1 });
        return;
      }
      // Only proceed once tokens are classified vs USDC to avoid early calls
      if (!stableIsToken0 && !stableIsToken1) {
        console.log('[Oracle] skip: not classified vs USDC yet');
        return;
      }
      // Throttle: at most one fetch every 15s
      const now = Date.now();
      if (now - oracleLastFetchRef.current < 15000) {
        console.log('[Oracle] skip: throttled');
        return;
      }
      oracleLastFetchRef.current = now;
      const assets = (cfg?.assets || {}) as any;
      const cbBtcAddr = (assets?.cbBTC?.address || '').toLowerCase();
      const wethAddr = (assets?.WETH?.address || '').toLowerCase();
      const usdcAddr = (assets?.USDC?.address || '').toLowerCase();
      const riskAddr = (stableIsToken0 ? token1 : token0).toLowerCase();
      // Determine risk feed directly from appConfig assets mapping
      const riskFeedAddr = (riskAddr === cbBtcAddr ? assets?.cbBTC?.feed : (riskAddr === wethAddr ? assets?.WETH?.feed : '')) as `0x${string}`;
      const usdcFeedAddr = (assets?.USDC?.feed || '') as `0x${string}`;
      // If we cannot determine a risk feed, bail
      if (!riskFeedAddr) {
        console.log('[Oracle] skip: could not determine risk feed', { riskAddr, cbBtcAddr, wethAddr, assets });
        return;
      }
      console.log('[Oracle] selected feeds', { riskFeedAddr, usdcFeedAddr, riskAddr, stableIsToken0, token0, token1 });

      let canceled = false;
      let retryTimeout: any = null;

      const fetchOracle = async (attempt: number) => {
        if (canceled) return;

        let riskUsd: number | null = null;
        let usdcUsd: number = 1; // default to 1 if missing

        try {
          const riskRound = await client.readContract({ address: riskFeedAddr, abi: FEED_ABI as any, functionName: 'latestRoundData', args: [] }) as any;
          const riskDec = 8; // Chainlink feeds are 8 decimals
          console.log('[Oracle] risk feed raw answer/decimals:', String(riskRound[1]), riskDec);
          riskUsd = Number(riskRound[1]) / Math.pow(10, riskDec);
        } catch (e) {
          console.warn('[Oracle] risk feed read failed', e);
        }

        // Base mainnet USDC is $1; Chainlink USDC/USD feed may be optional/not available. Default to 1 if missing.
        if (usdcFeedAddr && usdcFeedAddr !== '0x') {
          try {
            const usdcRound = await client.readContract({ address: usdcFeedAddr, abi: FEED_ABI as any, functionName: 'latestRoundData', args: [] }) as any;
            const usdcDec = 8; // Chainlink feeds are 8 decimals
            console.log('[Oracle] USDC feed raw answer/decimals:', String(usdcRound[1]), usdcDec);
            const v = Number(usdcRound[1]) / Math.pow(10, usdcDec);
            if (v > 0) usdcUsd = v;
          } catch (e) {
            console.warn('[Oracle] USDC feed read failed', e);
          }
        }

        if (!canceled && riskUsd !== null && riskUsd > 0) {
          const stablePerRisk = (usdcUsd && usdcUsd > 0) ? (riskUsd / usdcUsd) : riskUsd;
          setOracleStablePerRisk(stablePerRisk);
          // Map USD prices to token0/token1
          if (stableIsToken0) {
            setUsdPerToken0(usdcUsd);
            setUsdPerToken1(riskUsd);
          } else if (stableIsToken1) {
            setUsdPerToken1(usdcUsd);
            setUsdPerToken0(riskUsd);
          } else {
            setUsdPerToken0(null);
            setUsdPerToken1(null);
          }
          console.log('[Oracle] computed', { riskUsd, usdcUsd, stablePerRisk });
        } else if (!canceled && attempt < 10) {
          const delay = 4000 + attempt * 1000; // 5s, then 10s
          console.log('[Oracle] scheduling retry in ms', delay);
          retryTimeout = setTimeout(() => fetchOracle(attempt + 1), delay);
        } else if (!canceled) {
          console.log(`[Oracle] giving up after ${attempt} retries`);
        }
      };

      fetchOracle(0);

      return () => {
        canceled = true;
        try { if (retryTimeout) clearTimeout(retryTimeout as any); } catch {}
      };
    })();
  }, [ADDR?.btcUsdPriceFeed, ADDR?.ethUsdPriceFeed, ADDR?.usdcUsdPriceFeed, client, token0, token1, cfg?.assets, stableIsToken0, riskSymbol]);

  useEffect(() => {
    if (txConfirmed && txHash) {
      setLastTx(txHash);
      setToastOpen(true);
    }
  }, [txConfirmed, txHash]);

  const deviationPct = useMemo(() => {
    if (!oracleStablePerRisk || !poolStablePerRisk) return null;
    if (oracleStablePerRisk === 0) return null;
    return ((poolStablePerRisk - oracleStablePerRisk) / oracleStablePerRisk) * 100;
  }, [oracleStablePerRisk, poolStablePerRisk]);

  const isWethPool = useMemo(() => {
    const weth = (ADDR?.weth || '').toLowerCase();
    return (token0?.toLowerCase() === weth || token1?.toLowerCase() === weth);
  }, [ADDR?.weth, token0, token1]);

  const { writeContractAsync: write } = useWriteContract();
  const ensureApproval = async (token: `0x${string}`, spender: `0x${string}`, amount: bigint) => {
    try {
      const allowanceAbi = [
        { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
        { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] },
      ] as const;
      const owner = (account as `0x${string}`) || '0x0000000000000000000000000000000000000000';
      const current = await client.readContract({ address: token, abi: allowanceAbi as any, functionName: 'allowance', args: [owner, spender] }) as bigint;
      if (current >= amount) return;
      await ensureChain();
      await write({ address: token, abi: allowanceAbi as any, functionName: 'approve', args: [spender, amount] } as any);
    } catch {}
  };
  const handleWrap = async () => {
    try {
      if (!ADDR?.weth || !wrapAmount) return;
      const value = parseUnits(wrapAmount, 18);
      await ensureChain();
      const tx = await write({
        address: ADDR.weth as `0x${string}`,
        abi: [ { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] } ] as const,
        functionName: 'deposit',
        args: [],
        value,
      } as any);
      setTxHash(tx as `0x${string}`);
    } catch {}
  };
  const handleUnwrap = async () => {
    try {
      if (!ADDR?.weth || !unwrapAmount) return;
      const amount = parseUnits(unwrapAmount, 18);
      await ensureChain();
      const tx = await write({
        address: ADDR.weth as `0x${string}`,
        abi: [ { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'wad', type: 'uint256' }], outputs: [] } ] as const,
        functionName: 'withdraw',
        args: [amount],
      } as any);
      setTxHash(tx as `0x${string}`);
    } catch {}
  };

  // Add Liquidity (full range), compute corresponding risk asset from pool price
  const NFPM_MAP: Record<string, string> = {
    'base-sepolia': '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2',
    'base': '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  };
  async function handleAddLiquidity() {
    try {
      if (!isConnected || !account) {
        setErrorMsg('Connect your wallet'); setErrorOpen(true); return;
      }
      const amt = Number(usdcLiquidity);
      if (!usdcLiquidity || !isFinite(amt) || amt <= 0) {
        setErrorMsg('Enter a positive USDC amount'); setErrorOpen(true); return;
      }
      if (fee === null || !token0 || !token1) {
        setErrorMsg('Pool metadata not loaded yet, try again'); setErrorOpen(true); return;
      }
      const nfpm = NFPM_MAP[chainKey] as `0x${string}` | undefined;
      if (!nfpm) { setErrorMsg('Unsupported network'); setErrorOpen(true); return; }
      if (!poolStablePerRisk || poolStablePerRisk <= 0) { setErrorMsg('Pool price unavailable'); setErrorOpen(true); return; }
      const t0IsUSDC = token0?.toLowerCase() === (ADDR?.usdc || '').toLowerCase();
      const amountUSDC = parseUnits(usdcLiquidity, 6);
      // Compute required risk amount to provide roughly 50/50 value at current price
      const riskAddr = (t0IsUSDC ? token1 : token0) as `0x${string}`;
      const riskDecimals = t0IsUSDC ? dec1 : dec0;
      const riskNeededHuman = Number(usdcLiquidity) / poolStablePerRisk;
      const amountRiskNeeded = parseUnits(riskNeededHuman.toFixed(riskDecimals), riskDecimals);
      // Ensure approvals for both tokens
      await ensureApproval(ADDR.usdc as `0x${string}`, nfpm, amountUSDC);
      await ensureApproval(riskAddr, nfpm, amountRiskNeeded);

      const MIN_TICK = -887272;
      const MAX_TICK = 887272;
      const tickLower = MIN_TICK;
      const tickUpper = MAX_TICK;
      const amount0Desired = t0IsUSDC ? amountUSDC : amountRiskNeeded;
      const amount1Desired = t0IsUSDC ? amountRiskNeeded : amountUSDC;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
      const MINT_ABI = [
        { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [ { name: 'params', type: 'tuple', components: [
          { name: 'token0', type: 'address' }, { name: 'token1', type: 'address' }, { name: 'fee', type: 'uint24' },
          { name: 'tickLower', type: 'int24' }, { name: 'tickUpper', type: 'int24' },
          { name: 'amount0Desired', type: 'uint256' }, { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min', type: 'uint256' }, { name: 'amount1Min', type: 'uint256' },
          { name: 'recipient', type: 'address' }, { name: 'deadline', type: 'uint256' },
        ] } ], outputs: [ { type: 'uint256' }, { type: 'uint128' }, { type: 'uint256' }, { type: 'uint256' } ] },
      ] as const;
      setIsWorking(true);
      await ensureChain();
      const tx = await write({ address: nfpm, abi: MINT_ABI as any, functionName: 'mint', args: [{
        token0: token0 as `0x${string}`,
        token1: token1 as `0x${string}`,
        fee: fee as any,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min: BigInt(0),
        amount1Min: BigInt(0),
        recipient: account as `0x${string}`,
        deadline,
      }] } as any);
      setTxHash(tx as `0x${string}`);
    } catch (e: any) {
      const msg = (e?.shortMessage || e?.message || 'Transaction failed').toString();
      setErrorMsg(msg);
      setErrorOpen(true);
    } finally {
      setIsWorking(false);
    }
  }

  // Align to Oracle via QuoterV2 search + SwapRouter swap
  const quoterV2Map: Record<string, string> = {
    'base-sepolia': '0xC5290058841028F1614F3A6F0F5816cAd0df5E27',
    'base': '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  };
  // NonfungiblePositionManager
  const nfpmMap: Record<string, string> = {
    'base-sepolia': '0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2',
    'base': '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
  };

  // Live compute required risk amount
  const riskRequiredHuman = useMemo(() => {
    const amt = Number(usdcLiquidity);
    if (!isFinite(amt) || amt <= 0) return null;
    if (!poolStablePerRisk || poolStablePerRisk <= 0) return null;
    return amt / poolStablePerRisk;
  }, [usdcLiquidity, poolStablePerRisk]);
  const riskRequiredDisplay = useMemo(() => {
    if (riskRequiredHuman === null) return '-';
    return riskRequiredHuman.toLocaleString('en-US', { maximumFractionDigits: 8 });
  }, [riskRequiredHuman]);
  const hasEnoughRisk = useMemo(() => {
    try {
      if (riskRequiredHuman === null || userRiskBal === null) return null;
      const decimals = (token0?.toLowerCase() === (ADDR?.usdc || '').toLowerCase()) ? dec1 : dec0;
      const required = parseUnits(riskRequiredHuman.toFixed(decimals), decimals);
      return userRiskBal >= required;
    } catch {
      return null;
    }
  }, [riskRequiredHuman, userRiskBal, token0, ADDR?.usdc, dec0, dec1]);

  const handleAlignToOracle = async () => {
    try {
      if (!poolAddress || fee === null || !oracleStablePerRisk || oracleStablePerRisk === 0) return;
      setIsWorking(true);
      const swapRouter = ADDR?.uniswapV3Router as `0x${string}`;
      const quoter = quoterV2Map[chainKey] as `0x${string}` | undefined;
      if (!swapRouter || !quoter) { setIsWorking(false); return; }

      // Determine input/output by comparing pool price change needed in pool order (token1 per token0)
      const currentPricePoolOrder = priceToken1PerToken0;
      // Convert oracle target to pool order
      const targetPoolOrder = stableIsToken0 ? (1 / oracleStablePerRisk) : oracleStablePerRisk;
      const priceNeedsIncrease = targetPoolOrder > currentPricePoolOrder;
      const inputToken = (priceNeedsIncrease ? token1 : token0) as `0x${string}`;
      const outputToken = (priceNeedsIncrease ? token0 : token1) as `0x${string}`;

      // Helper to quote post-swap price using quoterV2
      const amountInHumanStart = priceNeedsIncrease ? 1 : (token0?.toLowerCase() === ADDR?.usdc.toLowerCase() ? 100 : 0.001);
      const tokenInDec = (inputToken?.toLowerCase() === token0?.toLowerCase()) ? dec0 : dec1;
      const quotePriceAfter = async (amtHuman: number) => {
        const amt = parseUnits(amtHuman.toFixed(tokenInDec), tokenInDec);
        const [ , sqrtAfter ] = await client.readContract({ address: quoter, abi: QUOTER_ABI as any, functionName: 'quoteExactInputSingle', args: [{ tokenIn: inputToken, tokenOut: outputToken, amountIn: amt, fee: fee as any, sqrtPriceLimitX96: 0 }] }) as any;
        const q96 = Math.pow(2, 96);
        const ratio = Number(sqrtAfter) / q96;
        const pPool = ratio * ratio * Math.pow(10, dec0 - dec1);
        return pPool;
      };

      // Exponential grow then binary search
      let low = 0;
      let high = amountInHumanStart;
      let p = await quotePriceAfter(high);
      const target = targetPoolOrder;
      let iterations = 0;
      const maxHigh = (inputToken?.toLowerCase() === ADDR?.usdc.toLowerCase()) ? 10000 : 0.05;
      while (iterations < 20) {
        const crossed = priceNeedsIncrease ? (p >= target) : (p <= target);
        if (crossed) break;
        low = high; high = high * 2; if (high > maxHigh) break;
        p = await quotePriceAfter(high);
        iterations++;
      }
      let best = high;
      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        const pm = await quotePriceAfter(mid);
        const crossed = priceNeedsIncrease ? (pm >= target) : (pm <= target);
        if (crossed) { best = mid; high = mid; } else { low = mid; }
      }

      const amountInParsed = parseUnits(best.toFixed(tokenInDec), tokenInDec);
      // Perform swap with minimal slippage guard (0.5% of expected out)
      const SWAP_ABI = [
        { type: 'function', name: 'exactInputSingle', stateMutability: 'nonpayable', inputs: [ { name: 'params', type: 'tuple', components: [
          { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' }, { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' }, { name: 'amountIn', type: 'uint256' }, { name: 'amountOutMinimum', type: 'uint256' }, { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ] } ], outputs: [{ type: 'uint256' }] },
      ] as const;
      // We need a rough expected out to set minOut; reuse quoter for current amount
      const [amountOutQuoted] = await client.readContract({ address: quoter, abi: QUOTER_ABI as any, functionName: 'quoteExactInputSingle', args: [{ tokenIn: inputToken, tokenOut: outputToken, amountIn: amountInParsed, fee: fee as any, sqrtPriceLimitX96: 0 }] }) as any;
      const minOut = amountOutQuoted ? (amountOutQuoted * BigInt(995)) / BigInt(1000) : BigInt(0);

      // Approve tokenIn to router
      await ensureApproval(inputToken, swapRouter, amountInParsed);
      await ensureChain();
      const tx = await write({ address: swapRouter, abi: SWAP_ABI as any, functionName: 'exactInputSingle', args: [{ tokenIn: inputToken, tokenOut: outputToken, fee: fee as any, recipient: account as `0x${string}`, amountIn: amountInParsed, amountOutMinimum: minOut, sqrtPriceLimitX96: 0 }] } as any);
      setTxHash(tx as `0x${string}`);
    } catch {
    } finally {
      setIsWorking(false);
    }
  };

  // Slippage simulator: quote amountOut and compute USD in/out and slippage
  const handleSimulateSlippage = async () => {
    try {
      setSimResult(null);
      if (!poolAddress || fee === null) return;
      const quoter = quoterV2Map[chainKey] as `0x${string}` | undefined;
      if (!quoter) return;
      const amountNum = Number(simAmount);
      if (!isFinite(amountNum) || amountNum <= 0) return;
      const inputToken = (simTokenIn === 'token0' ? token0 : token1) as `0x${string}`;
      const outputToken = (simTokenIn === 'token0' ? token1 : token0) as `0x${string}`;
      const inDec = simTokenIn === 'token0' ? dec0 : dec1;
      const outDec = simTokenIn === 'token0' ? dec1 : dec0;
      const usdInPerToken = simTokenIn === 'token0' ? usdPerToken0 : usdPerToken1;
      const usdOutPerToken = simTokenIn === 'token0' ? usdPerToken1 : usdPerToken0;
      if (usdInPerToken === null || usdOutPerToken === null) return;
      setSimWorking(true);
      const amountInParsed = parseUnits(amountNum.toFixed(inDec), inDec);
      const [amountOut] = await client.readContract({ address: quoter, abi: QUOTER_ABI as any, functionName: 'quoteExactInputSingle', args: [{ tokenIn: inputToken, tokenOut: outputToken, amountIn: amountInParsed, fee: fee as any, sqrtPriceLimitX96: 0 }] }) as any;
      const amountOutHuman = Number(amountOut) / Math.pow(10, outDec);
      const usdIn = amountNum * usdInPerToken;
      const usdOut = amountOutHuman * usdOutPerToken;
      const eff = usdOut / usdIn;
      const slippagePct = (eff - 1) * 100;
      setSimResult({ amountOut: amountOutHuman, usdIn, usdOut, slippagePct });
    } catch {
      // ignore
    } finally {
      setSimWorking(false);
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '60vh' }}>
      <Container maxWidth="lg">
        {!poolAddress ? (
          <Typography variant="body2" color="text.secondary">No pool address provided. Go back to{' '}<MuiLink href="/contracts">Smart Contracts</MuiLink>.</Typography>
        ) : (
          <>
            <Typography variant="h4" fontWeight="bold" gutterBottom>Pool Management</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{shortAddr}</Typography>
              {explorerBase && poolAddress ? (
                <Tooltip title="Open in block explorer">
                  <a href={`${explorerBase}/address/${poolAddress}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center' }} aria-label="Open on block explorer">
                    <LaunchIcon sx={{ fontSize: 16 }} />
                  </a>
                </Tooltip>
              ) : null}
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="subtitle1" fontWeight="bold">Pool State</Typography>
                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    <Typography variant="body2">token0: {sym0} ({token0})</Typography>
                    <Typography variant="body2">token1: {sym1} ({token1})</Typography>
                    <Typography variant="body2">tick: {tick ?? '-'}</Typography>
                    <Typography variant="body2">liquidity: {liquidity?.toString() || '-'}</Typography>
                    <Typography variant="body2">reserves: {bal0 !== null ? formatNumber(Number(bal0) / Math.pow(10, dec0), stableIsToken0 ? 0 : 6) : '-'} {sym0} | {bal1 !== null ? formatNumber(Number(bal1) / Math.pow(10, dec1), stableIsToken1 ? 0 : 6) : '-'} {sym1}</Typography>
                    <Typography variant="body2">price: 1 {riskSymbol || 'RISK'} = {poolStablePerRisk > 0 ? formatNumber(poolStablePerRisk, 0) : '-'} USDC</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      TVL: ${(() => {
                        const usd0 = (usdPerToken0 !== null && bal0 !== null) ? (Number(bal0) / Math.pow(10, dec0)) * (usdPerToken0 || 0) : null;
                        const usd1 = (usdPerToken1 !== null && bal1 !== null) ? (Number(bal1) / Math.pow(10, dec1)) * (usdPerToken1 || 0) : null;
                        if (usd0 === null && usd1 === null) return '-';
                        const tvl = (usd0 ?? 0) + (usd1 ?? 0);
                        return tvl > 0 ? formatNumber(tvl, 0) : '-';
                      })()}
                    </Typography>
                  </Stack>
                </CardContent></Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="subtitle1" fontWeight="bold">Oracle vs Pool Price</Typography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Typography variant="body2">Pool: 1 {riskSymbol || 'RISK'} = {formatNumber(poolStablePerRisk || 0, 0)} USDC</Typography>
                    <Typography variant="body2">Oracle: 1 {riskSymbol || 'RISK'} = {oracleStablePerRisk !== null ? formatNumber(oracleStablePerRisk, 0) : '-'} USDC</Typography>
                    <Typography variant="body2">Deviation: {deviationPct !== null ? `${deviationPct > 0 ? '+' : ''}${formatNumber(deviationPct, 3)}%` : '-'}</Typography>
                  </Stack>
                </CardContent></Card>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2 }}>
                <Card variant="outlined"><CardContent>
                  <Typography variant="subtitle1" fontWeight="bold">Actions</Typography>
                  <Stack spacing={1.5} sx={{ mt: 1 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={5} alignItems="stretch">
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, mt: 1 }}>Align Exchange Rate to Oracle</Typography>
                        
                        <Button
                          variant="outlined"
                          onClick={handleAlignToOracle}
                          disabled={!isConnected || oracleStablePerRisk === null || fee === null || isWorking}
                          sx={{ minWidth: { md: 220 }, alignSelf: { xs: 'stretch', md: 'auto' } }}
                        >
                          Align to Oracle
                        </Button>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, maxWidth: { md: 220 } }}>
                          {`Perform a swap to align the exchange rate of the assets in the pool to the price of ${riskSymbol || 'RISK'} from the Oracle feed`}
                        </Typography>
                      </Box>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flex: 1, maxWidth: { md: 300 } }}>
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, mt: 1 }}>Add Liquidity</Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                            <Box sx={{ flex: 1 }}>
                              <TextField size="small" label="USDC Amount" value={usdcLiquidity} onChange={(e) => setUsdcLiquidity(e.target.value)} fullWidth />
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {`Your USDC: ${userUsdcBal !== null ? (Number(userUsdcBal) / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 6 }) : '-'}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {`Your ${riskSymbol || 'RISK'}: ${userRiskBal !== null ? (Number(userRiskBal) / Math.pow(10, stableIsToken0 ? dec1 : dec0)).toLocaleString('en-US', { maximumFractionDigits: 8 }) : '-'}`}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', color: hasEnoughRisk === false ? 'error.main' : 'text.secondary' }}>
                                {`Required ${riskSymbol || 'RISK'}: ${riskRequiredDisplay}`}
                              </Typography>
                            </Box>
                            <Button
                              variant="outlined"
                              onClick={handleAddLiquidity}
                              disabled={!isConnected || !usdcLiquidity || Number(usdcLiquidity) <= 0 || fee === null || !token0 || !token1 || isWorking}
                              sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
                            >
                              Add Liquidity
                            </Button>
                          </Stack>
                        </Box>
                        
                      </Stack>
                    </Stack>
                    {isWethPool ? (
                      <>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <TextField size="small" label="Wrap ETH amount" value={wrapAmount} onChange={(e) => setWrapAmount(e.target.value)} fullWidth />
                          <Button variant="outlined" onClick={handleWrap} disabled={!isConnected || !wrapAmount}>Wrap to WETH</Button>
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <TextField size="small" label="Unwrap WETH amount" value={unwrapAmount} onChange={(e) => setUnwrapAmount(e.target.value)} fullWidth />
                          <Button variant="outlined" onClick={handleUnwrap} disabled={!isConnected || !unwrapAmount}>Unwrap to ETH</Button>
                        </Stack>
                      </>
                    ) : null}
                  </Stack>
                </CardContent></Card>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Card variant="outlined"><CardContent>
                <Typography variant="subtitle1" fontWeight="bold">Slippage Simulator</Typography>
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      color="primary"
                      value={simTokenIn}
                      onChange={(_, v) => v && setSimTokenIn(v)}
                    >
                      <ToggleButton value="token0">From {sym0 || 'token0'}</ToggleButton>
                      <ToggleButton value="token1">From {sym1 || 'token1'}</ToggleButton>
                    </ToggleButtonGroup>
                    <TextField size="small" label="Amount In" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} sx={{ maxWidth: 240 }} />
                    <Button variant="outlined" onClick={handleSimulateSlippage} disabled={simWorking || !fee || !poolAddress || !simAmount}>Simulate Slippage</Button>
                  </Stack>
                  {simResult ? (
                    <Stack spacing={0.25}>
                      <Typography variant="body2">
                        Estimated Out: {formatNumber(simResult.amountOut, 8)} {simTokenIn === 'token0' ? (sym1 || 'token1') : (sym0 || 'token0')} (~${formatNumber(simResult.usdOut, 2)})
                      </Typography>
                      <Typography variant="body2">USD In: ~${formatNumber(simResult.usdIn, 2)}</Typography>
                      <Typography variant="body2">Slippage: {`${simResult.slippagePct > 0 ? '+' : ''}${formatNumber(simResult.slippagePct, 3)}%`}</Typography>
                    </Stack>
                  ) : null}
                </Stack>
              </CardContent></Card>
            </Box>
          </>
        )}
      </Container>
      <Snackbar
        open={toastOpen}
        autoHideDuration={6000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setToastOpen(false)} severity="success" sx={{ width: '100%' }}>
          Transaction confirmed.{' '}
          {explorerBase && lastTx ? (
            <Tooltip title="Open in block explorer">
              <a href={`${explorerBase}/tx/${lastTx}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                View on explorer
              </a>
            </Tooltip>
          ) : null}
        </Alert>
      </Snackbar>
      <Snackbar
        open={errorOpen}
        autoHideDuration={6000}
        onClose={() => setErrorOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setErrorOpen(false)} severity="error" sx={{ width: '100%' }}>
          {errorMsg || 'Something went wrong'}
        </Alert>
      </Snackbar>
    </Box>
  );
}



