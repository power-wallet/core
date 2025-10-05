'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Box, Card, CardContent, Container, Grid, Stack, Typography, Button, TextField } from '@mui/material';
import { createPublicClient, http, parseUnits } from 'viem';
import { getChainKey, getViemChain } from '@/config/networks';
import appConfig from '@/config/appConfig.json';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

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

function formatNumber(n: number, maxFrac = 6) {
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
}

export default function PoolPage() {
  const params = useParams<{ address: string }>();
  const poolAddress = (params?.address || '') as `0x${string}`;
  const chainId = useChainId();
  const chainKey = useMemo(() => getChainKey(chainId), [chainId]);
  const cfg = (appConfig as any)[chainKey];
  const client = useMemo(() => createPublicClient({ chain: getViemChain(chainId), transport: http(cfg?.rpcUrl) }), [chainId, cfg?.rpcUrl]);
  const ADDR = contractAddresses[chainKey];
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

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
  const [wrapAmount, setWrapAmount] = useState<string>('');
  const [unwrapAmount, setUnwrapAmount] = useState<string>('');

  useEffect(() => {
    (async () => {
      if (!poolAddress) return;
      try {
        const [slot0, t0, t1] = await Promise.all([
          client.readContract({ address: poolAddress, abi: POOL_ABI as any, functionName: 'slot0', args: [] }) as Promise<any>,
          client.readContract({ address: poolAddress, abi: POOL_ABI as any, functionName: 'token0', args: [] }) as Promise<`0x${string}`>,
          client.readContract({ address: poolAddress, abi: POOL_ABI as any, functionName: 'token1', args: [] }) as Promise<`0x${string}`>,
        ]);
        setSqrtPriceX96(BigInt(slot0[0]));
        setTick(Number(slot0[1]));
        setToken0(t0); setToken1(t1);
        const [d0, d1, s0, s1, liq, b0, b1] = await Promise.all([
          client.readContract({ address: t0, abi: ERC20_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
          client.readContract({ address: t1, abi: ERC20_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
          client.readContract({ address: t0, abi: ERC20_ABI as any, functionName: 'symbol', args: [] }) as Promise<string>,
          client.readContract({ address: t1, abi: ERC20_ABI as any, functionName: 'symbol', args: [] }) as Promise<string>,
          client.readContract({ address: poolAddress, abi: POOL_ABI as any, functionName: 'liquidity', args: [] }) as Promise<bigint>,
          client.readContract({ address: t0, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [poolAddress] }) as Promise<bigint>,
          client.readContract({ address: t1, abi: ERC20_ABI as any, functionName: 'balanceOf', args: [poolAddress] }) as Promise<bigint>,
        ]);
        setDec0(d0); setDec1(d1); setSym0(s0); setSym1(s1); setLiquidity(liq); setBal0(b0); setBal1(b1);
      } catch {}
    })();
  }, [poolAddress, client]);

  const priceToken1PerToken0 = useMemo(() => {
    if (!sqrtPriceX96) return 0;
    const q96 = Math.pow(2, 96);
    const ratio = Number(sqrtPriceX96) / q96;
    const pPool = ratio * ratio;
    return pPool * Math.pow(10, dec0 - dec1);
  }, [sqrtPriceX96, dec0, dec1]);

  const bal0Human = useMemo(() => bal0 !== null ? Number(bal0) / Math.pow(10, dec0) : 0, [bal0, dec0]);
  const bal1Human = useMemo(() => bal1 !== null ? Number(bal1) / Math.pow(10, dec1) : 0, [bal1, dec1]);

  // Determine stable/risk and compute pool stable per risk
  const stableIsToken0 = useMemo(() => token0 && ADDR?.usdc && token0.toLowerCase() === ADDR.usdc.toLowerCase(), [token0, ADDR?.usdc]);
  const stableIsToken1 = useMemo(() => token1 && ADDR?.usdc && token1.toLowerCase() === ADDR.usdc.toLowerCase(), [token1, ADDR?.usdc]);
  const riskSymbol = useMemo(() => {
    if (stableIsToken0) return sym1;
    if (stableIsToken1) return sym0;
    return '';
  }, [stableIsToken0, stableIsToken1, sym0, sym1]);
  const poolStablePerRisk = useMemo(() => {
    if (!token0 || !token1) return 0;
    if (stableIsToken0) {
      // token0 = USDC, priceToken1PerToken0 = risk/stable → invert
      return priceToken1PerToken0 === 0 ? 0 : (1 / priceToken1PerToken0);
    }
    if (stableIsToken1) {
      // token1 = USDC, priceToken1PerToken0 = stable/risk
      return priceToken1PerToken0;
    }
    return 0;
  }, [stableIsToken0, stableIsToken1, priceToken1PerToken0, token0, token1]);

  // Load oracle stable per risk (BTC/USD or ETH/USD over USDC/USD)
  useEffect(() => {
    (async () => {
      try {
        if (!ADDR?.btcUsdPriceFeed || !ADDR?.ethUsdPriceFeed || !ADDR?.usdcUsdPriceFeed) return;
        const riskIsBTC = (riskSymbol || '').toUpperCase().includes('BTC');
        const feedRisk = riskIsBTC ? ADDR.btcUsdPriceFeed : ADDR.ethUsdPriceFeed;
        const [riskRound, riskDec, usdcRound, usdcDec] = await Promise.all([
          client.readContract({ address: feedRisk as `0x${string}`, abi: FEED_ABI as any, functionName: 'latestRoundData', args: [] }) as Promise<any>,
          client.readContract({ address: feedRisk as `0x${string}`, abi: FEED_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
          client.readContract({ address: ADDR.usdcUsdPriceFeed as `0x${string}`, abi: FEED_ABI as any, functionName: 'latestRoundData', args: [] }) as Promise<any>,
          client.readContract({ address: ADDR.usdcUsdPriceFeed as `0x${string}`, abi: FEED_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
        ]);
        const riskUsd = Number(riskRound[1]) / Math.pow(10, riskDec);
        const usdcUsd = Number(usdcRound[1]) / Math.pow(10, usdcDec);
        const stablePerRisk = usdcUsd === 0 ? null : (riskUsd / usdcUsd);
        setOracleStablePerRisk(stablePerRisk);
      } catch {
        setOracleStablePerRisk(null);
      }
    })();
  }, [ADDR?.btcUsdPriceFeed, ADDR?.ethUsdPriceFeed, ADDR?.usdcUsdPriceFeed, client, riskSymbol]);

  const deviationPct = useMemo(() => {
    if (!oracleStablePerRisk || !poolStablePerRisk) return null;
    if (oracleStablePerRisk === 0) return null;
    return ((poolStablePerRisk - oracleStablePerRisk) / oracleStablePerRisk) * 100;
  }, [oracleStablePerRisk, poolStablePerRisk]);

  const isWethPool = useMemo(() => {
    const weth = (ADDR?.weth || '').toLowerCase();
    return (token0?.toLowerCase() === weth || token1?.toLowerCase() === weth);
  }, [ADDR?.weth, token0, token1]);

  const handleWrap = async () => {
    try {
      if (!ADDR?.weth || !wrapAmount) return;
      const value = parseUnits(wrapAmount, 18);
      const tx = await writeContractAsync({
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
      const tx = await writeContractAsync({
        address: ADDR.weth as `0x${string}`,
        abi: [ { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'wad', type: 'uint256' }], outputs: [] } ] as const,
        functionName: 'withdraw',
        args: [amount],
      } as any);
      setTxHash(tx as `0x${string}`);
    } catch {}
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Typography variant="h4" fontWeight="bold" gutterBottom>Pool Management</Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 2 }}>{poolAddress}</Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold">Pool State</Typography>
                <Stack spacing={0.75} sx={{ mt: 1 }}>
                  <Typography variant="body2">token0: {sym0} ({token0})</Typography>
                  <Typography variant="body2">token1: {sym1} ({token1})</Typography>
                  <Typography variant="body2">tick: {tick ?? '-'}</Typography>
                  <Typography variant="body2">liquidity: {liquidity?.toString() || '-'}</Typography>
                  <Typography variant="body2">reserves: {formatNumber(bal0Human)} {sym0} | {formatNumber(bal1Human)} {sym1}</Typography>
                  <Typography variant="body2">price: 1 {sym0} = {formatNumber(priceToken1PerToken0, 6)} {sym1}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold">Actions</Typography>
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  <Button variant="outlined" disabled>Align to Oracle (coming soon)</Button>
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
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField size="small" label="USDC Amount" disabled fullWidth />
                    <Button variant="outlined" disabled>Add Liquidity</Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        <Box sx={{ mt: 2 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold">Oracle vs Pool Price</Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                <Typography variant="body2">Pool: 1 {riskSymbol || 'RISK'} = {formatNumber(poolStablePerRisk || 0, 6)} USDC</Typography>
                <Typography variant="body2">Oracle: 1 {riskSymbol || 'RISK'} = {formatNumber(oracleStablePerRisk || 0, 0)} USDC</Typography>
                <Typography variant="body2">Deviation: {deviationPct !== null ? `${deviationPct > 0 ? '+' : ''}${formatNumber(deviationPct, 3)}%` : '-'}</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}


