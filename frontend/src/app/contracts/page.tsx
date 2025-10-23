'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Container, Box, Typography, Card, CardContent, Stack, Link as MuiLink, Divider, useMediaQuery, Button, Tabs, Tab } from '@mui/material';
import { useAccount, useChainId } from 'wagmi';
import { createPublicClient, http } from 'viem';
import appConfig from '@/config/appConfig.json';
import { getChainKey, getViemChain } from '@/config/networks';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';

// Constants will be computed inside component based on connection/network

const FACTORY_ABI = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getPool',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
];

// Will derive network-specific constants inside the component

type PoolInfo = {
  pool: string;
  token0: string;
  token1: string;
  dec0: number;
  dec1: number;
  sym0: string;
  sym1: string;
  bal0: string; // formatted (may include USD for risk)
  bal1: string; // formatted (may include USD for risk)
  unitPrice: string; // formatted: e.g., "119,000 USDC per cbBTC"
};

const ERC20_ABI = [
  { type: 'function', stateMutability: 'view', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', stateMutability: 'view', name: 'symbol', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', stateMutability: 'view', name: 'balanceOf', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const FEED_ABI = [
  { type: 'function', stateMutability: 'view', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', stateMutability: 'view', name: 'latestRoundData', inputs: [], outputs: [
    { name: 'roundId', type: 'uint80' },
    { name: 'answer', type: 'int256' },
    { name: 'startedAt', type: 'uint256' },
    { name: 'updatedAt', type: 'uint256' },
    { name: 'answeredInRound', type: 'uint80' },
  ] },
];

function formatNumber(n: number, maxFrac = 4) {
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
}
function formatUSD(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function SmartContractsPage() {
  const isMobile = useMediaQuery('(max-width:600px)');
  const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '');
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const isBaseMainnet = isConnected && chainId === 8453;
  const showTokens = !isConnected || chainId === 84532 || chainId === 8453;
  const chainKey = isBaseMainnet ? 'base' : 'base-sepolia';
  const cfg = (appConfig as any)[chainKey];
  const addrChain = (contractAddresses as any)[chainKey];
  const explorerBase = String(cfg?.explorer || '');
  const BASESCAN = `${explorerBase}/address/`;
  const BASE_RPC = String(cfg?.rpcUrl || '');
  const FEE_001 = Number(((cfg?.pools || {})['USDC-cbBTC'] || {}).fee || 0);
  const FEE_002 = Number(((cfg?.pools || {})['USDC-WETH'] || {}).fee || 0);

  const viemChain = getViemChain(chainKey === 'base' ? 8453 : 84532);
  const ADDR = {
    uniswapV3Factory: String(addrChain?.uniswapV3Factory || ''),
    uniswapV3Router: String(addrChain?.uniswapV3Router || ''),
    usdc: String(addrChain?.usdc || ''),
    weth: String(addrChain?.weth || ''),
    cbBTC: String(addrChain?.cbBTC || ''),
    btcUsdPriceFeed: String(addrChain?.btcUsdPriceFeed || ''),
    ethUsdPriceFeed: String(addrChain?.ethUsdPriceFeed || ''),
    walletFactory: String(addrChain?.walletFactory || ''),
    strategyRegistry: String(addrChain?.strategyRegistry || ''),
    technicalIndicators: String(addrChain?.technicalIndicators || ''),
    automator: String(addrChain?.automator || ''),
    faucet: String(addrChain?.faucet || ''),
    strategies: {
      'simple-btc-dca-v1': String(addrChain?.strategies?.['simple-btc-dca-v1'] || ''),
      'power-btc-dca-v2': String(addrChain?.strategies?.['power-btc-dca-v2'] || ''),
      'smart-btc-dca-v2': String(addrChain?.strategies?.['smart-btc-dca-v2'] || ''),
      'trend-btc-dca-v1': String(addrChain?.strategies?.['trend-btc-dca-v1'] || ''),
    },
  } as const;
  // BASESCAN already defined above
  const addTokenToWallet = async (key: 'cbBTC' | 'WETH' | 'USDC') => {
    try {
      const assetCfg = (cfg?.assets as any)?.[key];
      const address = (key === 'cbBTC')
        ? (ADDR as any).cbBTC
        : (ADDR as any)[key.toLowerCase()];
      if (!address || !assetCfg) return;
      await (window as any)?.ethereum?.request?.({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address,
            symbol: assetCfg.symbol,
            decimals: Number(assetCfg.decimals || 18),
          },
        },
      });
    } catch {}
  };
  const [cbBtcUsdcPool, setCbBtcUsdcPool] = useState<string>('');
  const [wethUsdcPool, setWethUsdcPool] = useState<string>('');
  const [cbBtcInfo, setCbBtcInfo] = useState<PoolInfo | null>(null);
  const [wethInfo, setWethInfo] = useState<PoolInfo | null>(null);
  const [btcUsd, setBtcUsd] = useState<{ price: number; updatedAt: number } | null>(null);
  const [ethUsd, setEthUsd] = useState<{ price: number; updatedAt: number } | null>(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    let mounted = true;
    if (!ADDR?.uniswapV3Factory || !ADDR?.usdc || !ADDR?.cbBTC || !FEE_001 || !FEE_002 || !BASE_RPC) return;
    // Only resolve pools when Uniswap tab is visible
    if (tab !== 2) return;
    const client = createPublicClient({ chain: viemChain, transport: http(BASE_RPC, { batch: true }) });
    (async () => {
      try {
        // Uniswap V3 Factory expects token0 < token1 (sorted by address)
        const sortPair = (a: string, b: string): [string, string] => (a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]);
        const [a1, b1] = sortPair(ADDR.cbBTC, ADDR.usdc);
        const [a2, b2] = sortPair(ADDR.weth, ADDR.usdc);
        const pool1 = await client.readContract({ address: ADDR.uniswapV3Factory as `0x${string}`, abi: FACTORY_ABI as any, functionName: 'getPool', args: [a1 as `0x${string}`, b1 as `0x${string}`, FEE_001] });
        const pool2 = await client.readContract({ address: ADDR.uniswapV3Factory as `0x${string}`, abi: FACTORY_ABI as any, functionName: 'getPool', args: [a2 as `0x${string}`, b2 as `0x${string}`, FEE_002] });
        if (!mounted) return;
        // Fallback to known pool on Base mainnet if factory resolution fails
        const zero = '0x0000000000000000000000000000000000000000';
        const knownBaseCbBtcPool = '0xfBB6Eed8e7aa03B138556eeDaF5D271A5E1e43ef';
        const resolved1 = String(pool1);
        setCbBtcUsdcPool(
          resolved1 && resolved1 !== zero ? resolved1 : (chainKey === 'base' ? knownBaseCbBtcPool : '')
        );
        setWethUsdcPool(String(pool2));
      } catch (_) {
        // ignore; will render empty if unavailable
      }
    })();
    return () => { mounted = false; };
  }, [hydrated, tab, chainKey, ADDR.uniswapV3Factory, ADDR.cbBTC, ADDR.usdc, ADDR.weth, FEE_001, FEE_002, viemChain, BASE_RPC]);

  useEffect(() => {
    if (!hydrated) return;
    if (tab !== 2) return;
    if (!cbBtcUsdcPool && !wethUsdcPool) return;
    const client = createPublicClient({ chain: viemChain, transport: http(BASE_RPC, { batch: true }) });

    const loadPool = async (poolAddr: string, label: 'cbBTC' | 'weth') => {
      if (!poolAddr || poolAddr === '0x0000000000000000000000000000000000000000') return null;
      const slot0 = await client.readContract({
        address: poolAddr as `0x${string}`,
        abi: [
          { type: 'function', stateMutability: 'view', name: 'slot0', inputs: [], outputs: [
            { name: 'sqrtPriceX96', type: 'uint160' },
            { name: 'tick', type: 'int24' },
            { name: 'observationIndex', type: 'uint16' },
            { name: 'observationCardinality', type: 'uint16' },
            { name: 'observationCardinalityNext', type: 'uint16' },
            { name: 'feeProtocol', type: 'uint8' },
            { name: 'unlocked', type: 'bool' },
          ] },
          { type: 'function', stateMutability: 'view', name: 'token0', inputs: [], outputs: [{ type: 'address' }] },
          { type: 'function', stateMutability: 'view', name: 'token1', inputs: [], outputs: [{ type: 'address' }] },
        ] as const,
        functionName: 'slot0',
        args: [],
      }) as any;
      const sqrtPriceX96 = BigInt(slot0[0]);
      const tick = Number(slot0[1]);
      // Fetch token0/token1 addresses
      const token0Addr = await client.readContract({ address: poolAddr as `0x${string}`, abi: [{type:'function',name:'token0',stateMutability:'view',inputs:[],outputs:[{type:'address'}]}] as any, functionName: 'token0', args: [] }) as `0x${string}`;
      const token1Addr = await client.readContract({ address: poolAddr as `0x${string}`, abi: [{type:'function',name:'token1',stateMutability:'view',inputs:[],outputs:[{type:'address'}]}] as any, functionName: 'token1', args: [] }) as `0x${string}`;
      const [dec0, dec1, sym0, sym1] = await Promise.all([
        client.readContract({ address: token0Addr, abi: ERC20_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
        client.readContract({ address: token1Addr, abi: ERC20_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
        client.readContract({ address: token0Addr, abi: ERC20_ABI as any, functionName: 'symbol', args: [] }) as Promise<string>,
        client.readContract({ address: token1Addr, abi: ERC20_ABI as any, functionName: 'symbol', args: [] }) as Promise<string>,
      ]);
      const [bal0Raw, bal1Raw] = await Promise.all([
        client.readContract({ address: token0Addr, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [poolAddr as `0x${string}`] }) as Promise<bigint>,
        client.readContract({ address: token1Addr, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [poolAddr as `0x${string}`] }) as Promise<bigint>,
      ]);

      // Determine risk vs stable (assume USDC stable)
      const STABLE = ADDR.usdc.toLowerCase();
      const token0IsStable = token0Addr.toLowerCase() === STABLE;
      const riskAddr = token0IsStable ? token1Addr : token0Addr;
      const riskDec = token0IsStable ? dec1 : dec0;
      const riskSym = token0IsStable ? sym1 : sym0;
      // Price: USDC per 1 risk using tick (avoids BigInt precision/rounding issues)
      // price1_per_0 = 1.0001^tick * 10^(dec0 - dec1)
      // We want USDC per risk. If token0 is stable (USDC), invert by using -tick; else use tick directly.
      const effTick = token0IsStable ? -tick : tick;
      let priceUSDCperRisk: number = Math.pow(1.0001, effTick) * Math.pow(10, riskDec - 6);

      const bal0 = Number(bal0Raw) / 10 ** dec0;
      const bal1 = Number(bal1Raw) / 10 ** dec1;
      const riskBal = token0IsStable ? bal1 : bal0;
      const usdVal = riskBal * priceUSDCperRisk;
      const unitPrice = `${formatUSD(priceUSDCperRisk)} per ${riskSym}`;
      const riskUsdText = `${formatUSD(usdVal)}`;
      const disp0 = token0IsStable ? `${formatNumber(bal0)} ${sym0}` : `${formatNumber(bal0)} ${sym0} (${riskUsdText})`;
      const disp1 = token0IsStable ? `${formatNumber(bal1)} ${sym1} (${riskUsdText})` : `${formatNumber(bal1)} ${sym1}`;

      const info: PoolInfo = {
        pool: poolAddr,
        token0: token0Addr,
        token1: token1Addr,
        dec0, dec1, sym0, sym1,
        bal0: disp0,
        bal1: disp1,
        unitPrice,
      };
      return info;
    };

    (async () => {
      try {
        if (cbBtcUsdcPool) {
          const info = await loadPool(cbBtcUsdcPool, 'cbBTC');
          if (info) setCbBtcInfo(info);
        }
        // Defer WETH pool extra calls to reduce RPC load; uncomment if needed
        // if (wethUsdcPool) {
        //   const info2 = await loadPool(wethUsdcPool, 'weth');
        //   if (info2) setWethInfo(info2);
        // }
      } catch (_) {
        // ignore
      }
    })();
  }, [hydrated, tab, cbBtcUsdcPool, wethUsdcPool, viemChain, BASE_RPC]);

  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    let mounted = true;
    // Only poll price feeds when Chainlink tab is visible
    if (tab !== 3) return;
    const client = createPublicClient({ chain: viemChain, transport: http(BASE_RPC, { batch: true }) });
    const load = async () => {
      console.log('Loading price feeds...');
      try {
        const [btcDec, btcRound]: [number, any] = await Promise.all([
          client.readContract({ address: ADDR.btcUsdPriceFeed as `0x${string}`, abi: FEED_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
          client.readContract({ address: ADDR.btcUsdPriceFeed as `0x${string}`, abi: FEED_ABI as any, functionName: 'latestRoundData', args: [] }) as Promise<any>,
        ]);
        const btcPrice = Number(btcRound[1]) / 10 ** btcDec;
        const btcUpdated = Number(btcRound[3]);
        if (mounted) setBtcUsd({ price: btcPrice, updatedAt: btcUpdated });

        const [ethDec, ethRound]: [number, any] = await Promise.all([
          client.readContract({ address: ADDR.ethUsdPriceFeed as `0x${string}`, abi: FEED_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
          client.readContract({ address: ADDR.ethUsdPriceFeed as `0x${string}`, abi: FEED_ABI as any, functionName: 'latestRoundData', args: [] }) as Promise<any>,
        ]);
        const ethPrice = Number(ethRound[1]) / 10 ** ethDec;
        const ethUpdated = Number(ethRound[3]);
        if (mounted) setEthUsd({ price: ethPrice, updatedAt: ethUpdated });
      } catch (_) {
        // ignore
      }
    };
    load();
    if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
    priceIntervalRef.current = setInterval(load, 30000);
    return () => { mounted = false; if (priceIntervalRef.current) clearInterval(priceIntervalRef.current); };
  }, [hydrated, tab, ADDR.btcUsdPriceFeed, ADDR.ethUsdPriceFeed, viemChain, BASE_RPC]);

  const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <MuiLink href={href} target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>{children}</MuiLink>
  );

  const Section = ({ title, address, blurb }: { title: string; address: string; blurb: string }) => (
    <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{blurb}</Typography>
        <Typography variant="body2">Address: <Ext href={BASESCAN + address}>{isMobile ? shortAddr(address) : address}</Ext></Typography>
      </CardContent>
    </Card>
  );

  if (!hydrated) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '60vh', py: 4 }}>
        <Container maxWidth="lg">
          <Typography variant="h5">Loading contracts...</Typography>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '60vh', py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">Smart Contracts</Typography>
          <Typography variant="body1" color="text.secondary">On-chain components powering Power Wallet on Base Sepolia</Typography>
        </Box>
        <Box sx={{ mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons allowScrollButtonsMobile>
            <Tab label="Core Contracts" />
            <Tab label="Strategies" />
            <Tab label="Uniswap" />
            <Tab label="Chainlink" />
            <Tab label="Tokens" />
          </Tabs>
        </Box>

        {tab === 0 && (
          <Stack spacing={2}>
            <Section title="Wallet Factory"
              address={ADDR.walletFactory}
              blurb="Creates PowerWallet instances and configures them with strategy instances." />

            <Section title="Strategy Registry"
              address={ADDR.strategyRegistry}
              blurb="Registry of investment strategies mapping strategy ids to implementation templates (for cloning)." />

            <Section title="Wallet Automator"
              address={ADDR.automator}
              blurb="Automation contract coordinating periodic upkeep for wallets and related strategies." />

            {!isBaseMainnet && (
              <>
                <Section title="Faucet"
                  address={ADDR.faucet}
                  blurb="For Power Wallet users to claim testnet USDC on Base Sepolia." />

                <Section title="Pool Rebalancer (cbBTC/USDC)"
                  address={(cfg.pools as any)['USDC-cbBTC']?.rebalancer || ''}
                  blurb="Periodically rebalances the assets in the cbBTC/USDC pool, and aligns the pool exchange rate to the Chainlink BTC/USD oracle price." />
              </>
            )}

            <Section title="Technical Indicators"
              address={ADDR.technicalIndicators}
              blurb="Calculates and stores daily indicators (e.g. SMA, RSI) using Chainlink price feeds." />
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            <Section title="Pure BTC DCA"
              address={ADDR.strategies['simple-btc-dca-v1']}
              blurb="The OG accumulator: dollar‑cost average into BTC on a set cadence." />

            <Section title="Power BTC DCA"
              address={ADDR.strategies['power-btc-dca-v2']}
              blurb="DCA strategy with a mean reversion twist. Uses the Bitcoin power-law price model to buy more below trend and trim above." />

            <Section title="Smart BTC DCA"
              address={ADDR.strategies['smart-btc-dca-v2']}
              blurb="An adaptive BTC DCA that buys dips more aggressively, with a volatility/drawdown kicker and optional band rebalancing." />

            <Section title="Trend BTC DCA"
              address={ADDR.strategies['trend-btc-dca-v1']}
              blurb="A strategy that steadily accumulates below trend, and goes all‑in when the trend is up." />
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={2}>
            <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Uniswap V3 Pools</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Pools to perform swaps between the risk assets (cbBTC and WETH) and stablecoin (USDC).
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    cbBTC / USDC: {cbBtcUsdcPool ? (<Ext href={BASESCAN + cbBtcUsdcPool}>{isMobile ? shortAddr(cbBtcUsdcPool) : cbBtcUsdcPool}</Ext>) : 'Resolving...'}{' '}
                    {cbBtcUsdcPool ? (
                      <Button size="small" variant="outlined" href={`/pools?address=${cbBtcUsdcPool}`} sx={{ ml: 1 }}>Manage</Button>
                    ) : null}
                  </Typography>
                  {cbBtcInfo && (
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="caption" color="text.secondary">Balances</Typography>
                      <Typography variant="body2">{cbBtcInfo.bal0}</Typography>
                      <Typography variant="body2">{cbBtcInfo.bal1}</Typography>
                      <Typography variant="body2">Exchange Rate: {cbBtcInfo.unitPrice}</Typography>
                    </Box>
                  )}
                  <Typography variant="body2">
                    WETH / USDC: {wethUsdcPool ? (<Ext href={BASESCAN + wethUsdcPool}>{isMobile ? shortAddr(wethUsdcPool) : wethUsdcPool}</Ext>) : 'Resolving...'}{' '}
                    {wethUsdcPool ? (
                      <Button size="small" variant="outlined" href={`/pools?address=${wethUsdcPool}`} sx={{ ml: 1 }}>Manage</Button>
                    ) : null}
                  </Typography>
                  {wethInfo && (
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="caption" color="text.secondary">Balances</Typography>
                      <Typography variant="body2">{wethInfo.bal0}</Typography>
                      <Typography variant="body2">{wethInfo.bal1}</Typography>
                      <Typography variant="body2">Exchange Rate: {wethInfo.unitPrice}</Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Section title="Uniswap V3 Factory"
              address={ADDR.uniswapV3Factory}
              blurb="Core factory for Uniswap v3 pools. We query it to resolve pool addresses." />

            <Section title="Uniswap V3 Router"
              address={ADDR.uniswapV3Router}
              blurb="Periphery router used by PowerWallet to execute swaps on Uniswap v3." />
          </Stack>
        )}

        {tab === 3 && (
          <Stack spacing={2}>
            <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Automation</Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  We use Chainlink Automation to keep exchange rates for Uniswap pools, technical indicators, and wallet strategies up to date.
                </Typography>
                <Stack spacing={1}>
                  {isBaseMainnet ? (
                    <>
                      <Typography variant="body2">
                        <MuiLink href="https://automation.chain.link/base/88136456891028586984976227682884546429640923155914433484249919148979741209337" target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>
                          Wallet Automator
                        </MuiLink>
                      </Typography>
                      <Typography variant="body2">
                        <MuiLink href="https://automation.chain.link/base/111818787295802735117938141445873732204762838649835594483642325261287779917420" target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>
                          Technical Indicators
                        </MuiLink>
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="body2">
                        <MuiLink href="https://automation.chain.link/base-sepolia/94249346813794909568170050542273685425709953412783663123746110309804194850178" target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>
                          Wallet Automator
                        </MuiLink>
                      </Typography>
                      <Typography variant="body2">
                        <MuiLink href="https://automation.chain.link/base-sepolia/81895955134147226903487285099620719932342719579785627792036034521300599077639" target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>
                          Pool Rebalancer (cbBTC/USDC)
                        </MuiLink>
                      </Typography>
                      <Typography variant="body2">
                        <MuiLink href="https://automation.chain.link/base-sepolia/8004073430779205612692946193676807911407093530369256047496210613749968071145" target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>
                          Technical Indicators
                        </MuiLink>
                      </Typography>
                    </>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Oracle Price Feeds</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Live reference prices from Chainlink aggregators on Base Sepolia.
                </Typography>
                <Typography variant="body2">
                  BTC/USD: {btcUsd ? formatUSD(btcUsd.price) : 'Loading...'} {' '} <br />
                  <Ext href={BASESCAN + ADDR.btcUsdPriceFeed}>{isMobile ? shortAddr(ADDR.btcUsdPriceFeed) : ADDR.btcUsdPriceFeed}</Ext>
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  ETH/USD: {ethUsd ? formatUSD(ethUsd.price) : 'Loading...'} {' '} <br />
                  <Ext href={BASESCAN + ADDR.ethUsdPriceFeed}>{isMobile ? shortAddr(ADDR.ethUsdPriceFeed) : ADDR.ethUsdPriceFeed}</Ext>
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        )}

        {tab === 4 && (
          <Stack spacing={2}>
            {showTokens ? (
              <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>Tokens</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {isBaseMainnet ? 'Core tokens used by Power Wallet on Base chain.' : 'Core tokens used by Power Wallet on Base Sepolia network.'}
                  </Typography>
                  <Stack spacing={1} sx={{ maxWidth: 500 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">cbBTC</Typography>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {ADDR.cbBTC ? (
                          <MuiLink href={`${BASESCAN}${ADDR.cbBTC}`} target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>
                            {isMobile ? shortAddr(ADDR.cbBTC) : ADDR.cbBTC}
                          </MuiLink>
                        ) : '—'}
                      </Typography>
                      {isConnected && ADDR.cbBTC ? (
                        <Button size="small" variant="outlined" onClick={() => addTokenToWallet('cbBTC')}>Add</Button>
                      ) : null}
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">WETH</Typography>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {ADDR.weth ? (
                          <MuiLink href={`${BASESCAN}${ADDR.weth}`} target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>
                            {isMobile ? shortAddr(ADDR.weth) : ADDR.weth}
                          </MuiLink>
                        ) : '—'}
                      </Typography>
                      {isConnected && ADDR.weth ? (
                        <Button size="small" variant="outlined" onClick={() => addTokenToWallet('WETH')}>Add</Button>
                      ) : null}
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">USDC</Typography>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {ADDR.usdc ? (
                          <MuiLink href={`${BASESCAN}${ADDR.usdc}`} target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>
                            {isMobile ? shortAddr(ADDR.usdc) : ADDR.usdc}
                          </MuiLink>
                        ) : '—'}
                      </Typography>
                      {isConnected && ADDR.usdc ? (
                        <Button size="small" variant="outlined" onClick={() => addTokenToWallet('USDC')}>Add</Button>
                      ) : null}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ) : (
              <Typography variant="body2" color="text.secondary">Connect on Base or Base Sepolia to view token helpers.</Typography>
            )}
          </Stack>
        )}
      </Container>
    </Box>
  );
}


