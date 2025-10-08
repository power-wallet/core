'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Container, Box, Typography, Card, CardContent, Stack, Link as MuiLink, Divider, useMediaQuery, Button, Tabs, Tab } from '@mui/material';
import { useAccount, useChainId } from 'wagmi';
import { createPublicClient, http } from 'viem';
import appConfig from '@/config/appConfig.json';
import { getChainKey, getViemChain } from '@/config/networks';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';

// Show contract info for Base Sepolia (84532)
const chainKey = getChainKey(84532);
const explorerBase = (appConfig as any)[chainKey].explorer as string;
const BASESCAN = `${explorerBase}/address/`;

// Addresses from unified config + contracts addresses
const cfg = (appConfig as any)[chainKey];
const addrChain = contractAddresses[chainKey];
const ADDR = {
  uniswapV3Factory: String(addrChain.uniswapV3Factory || ''),
  uniswapV3Router: String(addrChain.uniswapV3Router || ''),
  usdc: String(addrChain.usdc),
  weth: String(addrChain.weth),
  cbBTC: String(addrChain.cbBTC || ''),
  btcUsdPriceFeed: String(addrChain.btcUsdPriceFeed),
  ethUsdPriceFeed: String(addrChain.ethUsdPriceFeed),
  walletFactory: String(addrChain.walletFactory || ''),
  strategyRegistry: String(addrChain.strategyRegistry || ''),
  technicalIndicators: String(addrChain.technicalIndicators || ''),
  strategies: {
    'simple-btc-dca-v1': String(addrChain.strategies['simple-btc-dca-v1'] || ''),
    'btc-dca-power-law-v1': String(addrChain.strategies['btc-dca-power-law-v1'] || ''),
  },
} as const;

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

const FEE_001 = cfg.pools['USDC-cbBTC'].fee as number;
const BASE_SEPOLIA_RPC = cfg.rpcUrl as string;

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
  const isBaseMainnet = isConnected && chainId === 8453;
  const showTokens = !isConnected || chainId === 84532 || chainId === 8453;
  const addTokenToWallet = async (key: 'cbBTC' | 'WETH' | 'USDC') => {
    try {
      const assetCfg = (cfg.assets as any)[key];
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
    let mounted = true;
    const client = createPublicClient({ chain: getViemChain(84532), transport: http(BASE_SEPOLIA_RPC) });
    (async () => {
      try {
        const pool1 = await client.readContract({
          address: ADDR.uniswapV3Factory as `0x${string}`,
          abi: FACTORY_ABI as any,
          functionName: 'getPool',
          args: [ADDR.cbBTC as `0x${string}`, ADDR.usdc as `0x${string}`, FEE_001],
        });
        const pool2 = await client.readContract({
          address: ADDR.uniswapV3Factory as `0x${string}`,
          abi: FACTORY_ABI as any,
          functionName: 'getPool',
          args: [ADDR.weth as `0x${string}`, ADDR.usdc as `0x${string}`, FEE_001],
        });
        if (!mounted) return;
        setCbBtcUsdcPool(String(pool1));
        setWethUsdcPool(String(pool2));
      } catch (_) {
        // ignore; will render empty if unavailable
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!cbBtcUsdcPool && !wethUsdcPool) return;
    const client = createPublicClient({ chain: getViemChain(84532), transport: http(BASE_SEPOLIA_RPC) });

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
        if (wethUsdcPool) {
          const info2 = await loadPool(wethUsdcPool, 'weth');
          if (info2) setWethInfo(info2);
        }
      } catch (_) {
        // ignore
      }
    })();
  }, [cbBtcUsdcPool, wethUsdcPool]);

  useEffect(() => {
    let mounted = true;
    const client = createPublicClient({ chain: getViemChain(84532), transport: http(BASE_SEPOLIA_RPC) });
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
    const id = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

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

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">Smart Contracts</Typography>
          <Typography variant="body1" color="text.secondary">On-chain components powering Power Wallet on Base Sepolia</Typography>
        </Box>
        <Box sx={{ mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons allowScrollButtonsMobile>
            <Tab label="Power Wallet" />
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

            <Section title="Simple BTC DCA"
              address={ADDR.strategies['simple-btc-dca-v1']}
              blurb="Simple DCA Strategy into BTC that invests a fixed amount of USDC at a fixed frequency." />

            <Section title="Smart BTC DCA"
              address={ADDR.strategies['btc-dca-power-law-v1']}
              blurb="Smart DCA Strategy into BTC with optimized buy and sell amounts based on the Bitcoin Power Law price model." />

            <Section title="Technical Indicators"
              address={ADDR.technicalIndicators}
              blurb="Calculates and stores daily indicators (e.g. SMA, RSI) using Chainlink price feeds." />
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Uniswap V3 Pools</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Uniswap V3 Pools to perform swaps between the risk assets (e.g., cbBTC and WETH) and stablecoin (e.g., USDC).
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

        {tab === 2 && (
          <Stack spacing={2}>
            <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Chainlink Automation</Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  We use Chainlink Automation to keep price feeds and technical indicators up to date on-chain.
                </Typography>
                <Typography variant="body2">
                  <MuiLink href="https://automation.chain.link/base-sepolia/8004073430779205612692946193676807911407093530369256047496210613749968071145" target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>Go to Chainlink Automation</MuiLink>
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Chainlink BTC/USD and ETH/USD Price Feeds</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Live reference prices from Chainlink aggregators on Base Sepolia.
                </Typography>
                <Typography variant="body2">
                  BTC/USD: {btcUsd ? formatUSD(btcUsd.price) : 'Loading...'} {' '}<Ext href={BASESCAN + ADDR.btcUsdPriceFeed}>{isMobile ? shortAddr(ADDR.btcUsdPriceFeed) : ADDR.btcUsdPriceFeed}</Ext>
                </Typography>
                <Typography variant="body2">
                  ETH/USD: {ethUsd ? formatUSD(ethUsd.price) : 'Loading...'} {' '}<Ext href={BASESCAN + ADDR.ethUsdPriceFeed}>{isMobile ? shortAddr(ADDR.ethUsdPriceFeed) : ADDR.ethUsdPriceFeed}</Ext>
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        )}

        {tab === 3 && (
          <Stack spacing={2}>
            {showTokens ? (
              <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>Tokens</Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {isBaseMainnet ? 'Core tokens used by Power Wallet on Base chain.' : 'Core tokens used by Power Wallet on Base Sepolia network.'}
                  </Typography>
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        cbBTC: {ADDR.cbBTC ? (<MuiLink href={`${BASESCAN}${ADDR.cbBTC}`} target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>{isMobile ? shortAddr(ADDR.cbBTC) : ADDR.cbBTC}</MuiLink>) : '—'}
                      </Typography>
                      {isConnected && ADDR.cbBTC ? (
                        <Button size="small" variant="outlined" onClick={() => addTokenToWallet('cbBTC')}>Add</Button>
                      ) : null}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        WETH: {ADDR.weth ? (<MuiLink href={`${BASESCAN}${ADDR.weth}`} target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>{isMobile ? shortAddr(ADDR.weth) : ADDR.weth}</MuiLink>) : '—'}
                      </Typography>
                      {isConnected && ADDR.weth ? (
                        <Button size="small" variant="outlined" onClick={() => addTokenToWallet('WETH')}>Add</Button>
                      ) : null}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        USDC: {ADDR.usdc ? (<MuiLink href={`${BASESCAN}${ADDR.usdc}`} target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>{isMobile ? shortAddr(ADDR.usdc) : ADDR.usdc}</MuiLink>) : '—'}
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


