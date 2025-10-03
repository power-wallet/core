'use client';

import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Box, Button, Card, CardContent, Container, Grid, Stack, Typography } from '@mui/material';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import baseSepoliaAssets from '@/lib/assets/base-sepolia.json';
import { readContract } from 'viem/actions';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const powerWalletAbi = [
  { type: 'function', name: 'getBalances', stateMutability: 'view', inputs: [], outputs: [
    { name: 'stableBal', type: 'uint256' },
    { name: 'riskBals', type: 'uint256[]' },
  ] },
  { type: 'function', name: 'getRiskAssets', stateMutability: 'view', inputs: [], outputs: [ { name: 'assets', type: 'address[]' } ] },
  { type: 'function', name: 'getPortfolioValueUSD', stateMutability: 'view', inputs: [], outputs: [ { name: 'usd6', type: 'uint256' } ] },
  { type: 'function', name: 'strategy', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'address' } ] },
  { type: 'function', name: 'stableAsset', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'address' } ] },
];

const simpleDcaAbi = [
  { type: 'function', name: 'description', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'string' } ] },
  { type: 'function', name: 'frequency', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
  { type: 'function', name: 'dcaAmountStable', stateMutability: 'view', inputs: [], outputs: [ { name: '', type: 'uint256' } ] },
];

function formatUsd6(v?: bigint) {
  if (!v) return '0.00';
  const num = Number(v) / 1_000_000;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function WalletDetailsPage() {
  // Support both dynamic route and query param entry
  const params = useParams<{ address?: string }>();
  const sp = useSearchParams();
  const walletAddress = (params?.address as `0x${string}` | undefined) || (sp.get('address') as `0x${string}` | null) || ('0x' as `0x${string}`);
  const chainId = useChainId();
  const { address: connected } = useAccount();
  const getExplorerBase = (id?: number) => {
    if (id === 8453) return 'https://basescan.org';
    if (id === 84532) return 'https://sepolia.basescan.org';
    return '';
  };
  const shortAddress = React.useMemo(() => {
    if (!walletAddress || walletAddress.length < 10) return walletAddress;
    return `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const { data: assets } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'getRiskAssets',
  });
  const { data: balances } = useReadContract({
    address: walletAddress,
    abi: powerWalletAbi as any,
    functionName: 'getBalances',
  });
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
  const { data: desc } = useReadContract({
    address: strategyAddr as `0x${string}` | undefined,
    abi: simpleDcaAbi as any,
    functionName: 'description',
    query: { enabled: Boolean(strategyAddr) },
  });

  const riskAssets = (assets as string[] | undefined) || [];
  const stableBal = (balances as any)?.[0] as bigint | undefined;
  const riskBals = ((balances as any)?.[1] as bigint[] | undefined) || [];

  // Helpers to map address -> symbol/decimals/feed
  const chainAssets = baseSepoliaAssets as Record<string, { address: string; symbol: string; decimals: number; feed: `0x${string}` }>;
  const addressToMeta = (addr: string | undefined) => {
    if (!addr) return undefined;
    const lower = addr.toLowerCase();
    const entries = Object.values(chainAssets);
    return entries.find(a => a.address.toLowerCase() === lower);
  };

  const formatTokenAmount = (amount?: bigint, decimals?: number) => {
    if (amount === undefined || decimals === undefined) return '0';
    const base = 10 ** Math.min(decimals, 18);
    const value = Number(amount) / base;
    const fractionDigits = decimals >= 6 ? 4 : decimals;
    return value.toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
  };

  // Price reading client (Base Sepolia)
  const client = useMemo(() => createPublicClient({ chain: baseSepolia, transport: http() }), []);

  const aggregatorAbi = [
    { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
    { type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [], outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ] },
  ] as const;

  const [prices, setPrices] = React.useState<Record<string, { price: number; decimals: number }>>({});

  React.useEffect(() => {
    const metas = [addressToMeta(chainAssets.cbBTC.address), addressToMeta(chainAssets.WETH.address), addressToMeta(chainAssets.USDC.address)].filter(Boolean) as { address: string; symbol: string; decimals: number; feed: `0x${string}` }[];
    (async () => {
      const next: Record<string, { price: number; decimals: number }> = {};
      for (const m of metas) {
        try {
          const [dec, round] = await Promise.all([
            client.readContract({ address: m.feed, abi: aggregatorAbi as any, functionName: 'decimals' }) as Promise<number>,
            client.readContract({ address: m.feed, abi: aggregatorAbi as any, functionName: 'latestRoundData' }) as Promise<any>,
          ]);
          const p = Number(round[1]);
          next[m.symbol] = { price: p, decimals: dec };
        } catch (e) {}
      }
      setPrices(next);
    })();
  }, [client]);

  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Wallet <span style={{ fontFamily: 'monospace', fontSize: '0.8em', width: '10em' }}></span>
        {walletAddress && (
          <a
            href={`${getExplorerBase(chainId)}/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            {shortAddress}
          </a>
      )}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold">Portfolio</Typography>
              <Typography variant="h5" sx={{ mt: 1 }}>{formatUsd6(valueUsd as bigint)}</Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {(() => {
                  const order: string[] = ['cbBTC', 'WETH', 'USDC'];
                  const tiles: JSX.Element[] = [];
                  for (const sym of order) {
                    const m = (chainAssets as any)[sym] as { address: string; symbol: string; decimals: number; feed?: `0x${string}` } | undefined;
                    if (!m) continue;
                    let amt: bigint | undefined;
                    if (sym === 'USDC') {
                      amt = stableBal;
                    } else {
                      const idx = riskAssets.findIndex(x => x.toLowerCase() === m.address.toLowerCase());
                      if (idx === -1) continue;
                      amt = riskBals[idx];
                    }
                    const p = prices[m.symbol];
                    const usd = p ? (Number(amt || 0) * p.price) / 10 ** (m.decimals + p.decimals - 6) : undefined;
                    tiles.push(
                      <Grid key={sym} item xs={12} sm={6} md={4}>
                        <Stack>
                          <Typography variant="body1" fontWeight="bold">{formatTokenAmount(amt, m.decimals)} {m.symbol}</Typography>
                          <Typography variant="body2" color="text.secondary">{usd !== undefined ? `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}</Typography>
                        </Stack>
                      </Grid>
                    );
                  }
                  return tiles;
                })()}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold">Strategy</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{String(desc || '')}</Typography>
              <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                <Box>
                  <Typography variant="caption">DCA Amount</Typography>
                  <Typography variant="body1">{formatUsd6(dcaAmount as bigint)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption">Frequency</Typography>
                  <Typography variant="body1">{freq ? `${Number(freq) / 86400} d` : '-'}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                <Button variant="outlined" size="small">Deposit</Button>
                <Button variant="outlined" size="small">Withdraw</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}


