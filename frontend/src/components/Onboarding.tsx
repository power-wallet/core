'use client';

import React from 'react';
import { Container, Stack, Typography, Card, CardContent, Box, Button, Alert, CircularProgress } from '@mui/material';
import { useChainId, useReadContract, useSwitchChain } from 'wagmi';
import { getChainKey } from '@/config/networks';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import BaseSepoliaFaucets from './BaseSepoliaFaucets';

type Props = {
  isBaseSepolia: boolean;
  address?: `0x${string}` | null;
  connectorId?: string;
  needsFunding: boolean;
  onOpenCreate: () => void;
};

export default function Onboarding({ isBaseSepolia, address, connectorId, needsFunding, onOpenCreate }: Props) {
  const chainId = useChainId();
  const chainKey = getChainKey(chainId);
  const factoryAddress = ((contractAddresses as any)[chainKey] || {})?.walletFactory as `0x${string}` | undefined;
  const { switchChain } = useSwitchChain();

  const FACTORY_ABI = [
    { type: 'function', stateMutability: 'view', name: 'whitelistEnabled', inputs: [], outputs: [{ type: 'bool' }] },
    { type: 'function', stateMutability: 'view', name: 'isWhitelisted', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'bool' }] },
  ] as const;

  const { data: whitelistEnabled } = useReadContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'whitelistEnabled',
    query: { enabled: Boolean(factoryAddress && chainKey === 'base') },
  });

  const { data: isWhitelisted } = useReadContract({
    address: factoryAddress,
    abi: FACTORY_ABI,
    functionName: 'isWhitelisted',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(factoryAddress && address && whitelistEnabled === true && chainKey === 'base') },
  });

  const gatedOnBaseMainnet = chainKey === 'base' && whitelistEnabled === true && isWhitelisted === false;
  const whitelistChecksNeeded = chainKey === 'base' && Boolean(factoryAddress);
  const whitelistLoading = whitelistChecksNeeded && (whitelistEnabled === undefined || (whitelistEnabled === true && isWhitelisted === undefined));

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight="bold">Welcome to Power Wallet</Typography>
        {!gatedOnBaseMainnet && !whitelistLoading && (
          <Typography variant="body2" color="text.secondary">
            Create your first Power Wallet: an on-chain vault that can hold USDC and BTC, rebalancing these assets according to a strategy you choose.
            You will be the &quot;owner&quot; of the wallet &amp; strategy smart contracts, 
            which means only you interact with the wallet and your funds will be safe.
          </Typography>
        )}

        {whitelistLoading ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2} alignItems="center">
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary">Checking access…</Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : gatedOnBaseMainnet ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight="bold">Early Access Only</Typography>
                <Typography variant="body2" color="text.secondary">
                  Power Wallet is still in development and not ready for prime use on the Base mainnet chain. <br />
                  To request early access please contact the team via Telegram, or switch to the Base Sepolia testnet where you can experience a preview of the product we are building.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" href="https://t.me/power_wallet_finance" target="_blank" rel="noopener noreferrer">Telegram</Button>
                  <Button variant="contained" startIcon={<SwapHorizRoundedIcon />} onClick={() => switchChain?.({ chainId: 84532 })}>Switch to Base Sepolia</Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ) : !needsFunding ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight="bold">Create your wallet</Typography>
                <Typography variant="body2" color="text.secondary">When you’re ready, open the creator to select a strategy and parameters.</Typography>
                <Box>
                  <Button variant="contained" onClick={onOpenCreate}>Create Power Wallet</Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight="bold">Fund your account</Typography>

                {isBaseSepolia ? ( // Coinbase Smart Wallet
                  <> 
                    {connectorId === 'coinbaseWalletSDK' ? (
                      <Alert
                        severity="success"
                        icon={<InfoOutlinedIcon fontSize="small" />}
                        sx={{ mt: 1 }}
                      >
                        Using Coinbase Smart Wallet? <br />
                        You can continue without ETH: gas fees are sponsored by Base. 
                        You will still need USDC later to fund your wallet.
                      </Alert>
                    ) : ( // other connectors
                        <>
                            <Typography variant="body2" sx={{ display: 'block', mt: 1 }}>
                                You will need a small amount of ETH for gas to create your first Power Wallet.
                            </Typography>
                            <BaseSepoliaFaucets />
                        </>
                    )}
                    <Box>
                      <Button variant="contained" sx={{ mt: 1 }} onClick={onOpenCreate}>
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
                    {connectorId === 'coinbaseWalletSDK' ? (
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
                      <Button variant="contained" sx={{ mt: 1 }} onClick={onOpenCreate}>
                        Continue to Create Power Wallet
                      </Button>
                    </Box>
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}


