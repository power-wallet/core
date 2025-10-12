'use client';

import React from 'react';
import { Container, Stack, Typography, Card, CardContent, Box, Button, Alert } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BaseSepoliaFaucets from './BaseSepoliaFaucets';

type Props = {
  isBaseSepolia: boolean;
  address?: `0x${string}` | null;
  connectorId?: string;
  needsFunding: boolean;
  onOpenCreate: () => void;
};

export default function Onboarding({ isBaseSepolia, address, connectorId, needsFunding, onOpenCreate }: Props) {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Stack spacing={3}>
        <Typography variant="h4" fontWeight="bold">Welcome to Power Wallet</Typography>
        <Typography variant="body2" color="text.secondary">
          Create your first Power Wallet: an on-chain vault that can hold USDC and invest it into BTC according to a strategy you choose.
          Your connected account will be the &quot;owner&quot; of the wallet &amp; strategy smart contracts, which means no one else can interact with them, and mess with your funds.
        </Typography>

        {!needsFunding ? (
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


