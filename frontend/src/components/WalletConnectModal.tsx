'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Button,
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import { useConnect, useAccount, useDisconnect } from 'wagmi';

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
}

const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ open, onClose }) => {
  const { connect, connectors, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();

  const handleConnect = async (connector: any) => {
    try {
      await connect({ connector });
      onClose();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  const getConnectorIcon = (connectorId: string) => {
    if (connectorId === 'coinbaseWalletSDK') {
      return '🔷';
    } else if (connectorId === 'metaMask') {
      return '🦊';
    } else if (connectorId === 'walletConnect') {
      return '🔗';
    }
    return '💰';
  };

  const getConnectorName = (connectorId: string, connectorName: string) => {
    if (connectorId === 'coinbaseWalletSDK') {
      return 'Coinbase Smart Wallet';
    }
    return connectorName;
  };

  const getConnectorDescription = (connectorId: string) => {
    if (connectorId === 'coinbaseWalletSDK') {
      return 'Create a new wallet with your passkey - no recovery phrase needed';
    } else if (connectorId === 'metaMask') {
      return 'Connect using MetaMask browser extension';
    } else if (connectorId === 'walletConnect') {
      return 'Connect using WalletConnect protocol';
    }
    return 'Connect your wallet';
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          backgroundImage: 'none',
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div" fontWeight="bold">
            {isConnected ? 'Connected Wallet' : 'Connect Wallet'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {isConnected ? (
          <Box>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Connected Address
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {address}
                </Typography>
              </CardContent>
            </Card>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Choose how you want to connect:
            </Typography>
            
            {connectors.map((connector) => (
              <Card 
                key={connector.uid}
                variant="outlined"
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 2,
                  }
                }}
              >
                <CardContent>
                  <Button
                    fullWidth
                    onClick={() => handleConnect(connector)}
                    disabled={isPending}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      p: 1,
                    }}
                  >
                    <Box display="flex" alignItems="center" width="100%">
                      <Box
                        sx={{
                          fontSize: '2rem',
                          mr: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {connector.id === 'coinbaseWalletSDK' ? <AddIcon color="primary" /> : <AccountBalanceWalletIcon color="primary" />}
                      </Box>
                      <Box flex={1} textAlign="left">
                        <Typography variant="subtitle1" fontWeight="bold">
                          {getConnectorName(connector.id, connector.name)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getConnectorDescription(connector.id)}
                        </Typography>
                      </Box>
                    </Box>
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Box 
              sx={{ 
                mt: 3, 
                p: 2, 
                bgcolor: 'rgba(245, 158, 11, 0.1)', 
                borderRadius: 1,
                border: '1px solid rgba(245, 158, 11, 0.2)',
              }}
            >
              <Typography variant="caption" sx={{ color: '#FBB042' }}>
                💡 <strong>New to crypto?</strong> Choose Coinbase Smart Wallet to create a wallet instantly with just your passkey - no extensions or recovery phrases needed!
              </Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WalletConnectModal;
