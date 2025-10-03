'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Container, Box, Typography, Card, CardContent, Stack, Link as MuiLink, Divider } from '@mui/material';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const BASESCAN = 'https://sepolia.basescan.org/address/';

// Base Sepolia addresses (provided)
const ADDR = {
  uniswapV3Factory: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
  uniswapV3Router: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
  usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  weth: '0x4200000000000000000000000000000000000006',
  cbBTC: '0xcbB7C0006F23900c38EB856149F799620fcb8A4a',
  btcUsdPriceFeed: '0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298',
  ethUsdPriceFeed: '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1',
  walletFactory: '0x6e6A4C1094a064030c30607549BF8d87311cB219',
  strategyRegistry: '0x53B4C7F51904b888f61859971B11ff51a8e43F80',
  technicalIndicators: '0x7A0F3B371A2563627EfE1967E7645812909Eb6c5',
  strategies: {
    'simple-dca-v1': '0x316cc4fb12b1785aA38Cba5040AC2094B1d99709',
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

const FEE_001 = 100 as const;
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';

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

function formatNumber(n: number, maxFrac = 4) {
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
}
function formatUSD(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function SmartContractsPage() {
  const [cbBtcUsdcPool, setCbBtcUsdcPool] = useState<string>('');
  const [wethUsdcPool, setWethUsdcPool] = useState<string>('');
  const [cbBtcInfo, setCbBtcInfo] = useState<PoolInfo | null>(null);
  const [wethInfo, setWethInfo] = useState<PoolInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    const client = createPublicClient({ chain: baseSepolia, transport: http(BASE_SEPOLIA_RPC) });
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
    const client = createPublicClient({ chain: baseSepolia, transport: http(BASE_SEPOLIA_RPC) });

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
      // Price: USDC per 1 risk (no slippage) from sqrtPriceX96
      const Q96 = (BigInt(1) << BigInt(96));
      const ratioX192 = (sqrtPriceX96 * sqrtPriceX96); // Q192 scale
      let priceUSDCperRisk: number;
      if (token0IsStable) {
        // token0 = USDC, token1 = risk; price token0 per token1 = (Q192 / ratio) * 10^(dec1-dec0)
        const price0Per1 = Number((Q96 * Q96) / ratioX192);
        const adj = 10 ** (riskDec - 6);
        priceUSDCperRisk = price0Per1 * adj;
      } else {
        // token0 = risk, token1 = USDC; price token1 per token0 = ratio * 10^(dec1-dec0)
        const price1Per0 = Number(ratioX192 / (Q96 * Q96));
        const adj = 10 ** (6 - riskDec);
        priceUSDCperRisk = price1Per0 * adj;
      }

      const bal0 = Number(bal0Raw) / 10 ** dec0;
      const bal1 = Number(bal1Raw) / 10 ** dec1;
      const riskBal = token0IsStable ? bal1 : bal0;
      const usdVal = riskBal * priceUSDCperRisk;
      const unitPrice = `${formatNumber(priceUSDCperRisk, 6)} USDC per ${riskSym}`;
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

  const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <MuiLink href={href} target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>{children}</MuiLink>
  );

  const Section = ({ title, address, blurb }: { title: string; address: string; blurb: string }) => (
    <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{blurb}</Typography>
        <Typography variant="body2">Address: <Ext href={BASESCAN + address}>{address}</Ext></Typography>
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

        <Stack spacing={2}>
          <Section title="WalletFactory"
            address={ADDR.walletFactory}
            blurb="Creates PowerWallet instances and wires strategy instances; keeps track of user wallets." />

          <Section title="StrategyRegistry"
            address={ADDR.strategyRegistry}
            blurb="Registry of investment strategies mapping strategy ids to implementation templates (for cloning)." />

          <Section title="SimpleDCA"
            address={ADDR.strategies['simple-dca-v1']}
            blurb="Simple DCA Strategy that buys a fixed amount of risk asset at a fixed frequency." />

          <Section title="TechnicalIndicators"
            address={ADDR.technicalIndicators}
            blurb="Calculates and stores daily indicators (e.g., SMA, RSI) using Chainlink price feeds." />

          <Section title="Chainlink BTC/USD Price Feed"
            address={ADDR.btcUsdPriceFeed}
            blurb="BTC/USD reference oracle used for valuation and indicators." />

          <Section title="Chainlink ETH/USD Price Feed"
            address={ADDR.ethUsdPriceFeed}
            blurb="ETH/USD reference oracle used for valuation and indicators." />

          <Divider sx={{ borderColor: '#2D2D2D' }} />

          <Section title="Uniswap V3 Factory"
            address={ADDR.uniswapV3Factory}
            blurb="Core factory for Uniswap v3 pools. We query it to resolve pool addresses." />

          <Section title="Uniswap V3 Router"
            address={ADDR.uniswapV3Router}
            blurb="Periphery router used by PowerWallet to execute swaps on Uniswap v3." />

          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>Uniswap V3 Pools (fee 0.01%)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Uniswap V3 Pools to perform swaps between the risk assets (e.g., cbBTC and WETH) and stablecoin (e.g., USDC).
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  cbBTC / USDC: {cbBtcUsdcPool ? (<Ext href={BASESCAN + cbBtcUsdcPool}>{cbBtcUsdcPool}</Ext>) : 'Resolving...'}
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
                  WETH / USDC: {wethUsdcPool ? (<Ext href={BASESCAN + wethUsdcPool}>{wethUsdcPool}</Ext>) : 'Resolving...'}
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
        </Stack>

        <Box sx={{ mt: 4 }}>
          <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>Chainlink Automation</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                We use Chainlink Automation to keep price feeds and technical indicators (e.g., SMA, RSI) up to date on-chain.
              </Typography>
              <Typography variant="body2">
                Upkeep: <MuiLink href="https://automation.chain.link/base-sepolia/8004073430779205612692946193676807911407093530369256047496210613749968071145" target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA' }}>View on Chainlink Automation</MuiLink>
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}


