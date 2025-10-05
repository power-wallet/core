'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config/wagmi';
import React, { useEffect, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/lib/theme';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  function NetworkGuard() {
    const { isConnected } = useAccount();
    const currentChainId = useChainId();
    const { switchChainAsync } = useSwitchChain();
    const [showNetworkPrompt, setShowNetworkPrompt] = useState(false);

    useEffect(() => {
      if (isConnected && currentChainId && currentChainId !== baseSepolia.id) {
        setShowNetworkPrompt(true);
      } else {
        setShowNetworkPrompt(false);
      }
    }, [isConnected, currentChainId]);

    const handleSwitchNetwork = async () => {
      try {
        await switchChainAsync({ chainId: baseSepolia.id });
        setShowNetworkPrompt(false);
      } catch (_) {
        try {
          const params = {
            chainId: `0x${baseSepolia.id.toString(16)}`,
            chainName: baseSepolia.name,
            nativeCurrency: baseSepolia.nativeCurrency,
            rpcUrls: [baseSepolia.rpcUrls.default.http[0]],
            blockExplorerUrls: [baseSepolia.blockExplorers?.default.url || ''],
          } as const;
          await (window as any)?.ethereum?.request({
            method: 'wallet_addEthereumChain',
            params: [params],
          });
          await switchChainAsync({ chainId: baseSepolia.id });
          setShowNetworkPrompt(false);
        } catch {
          // keep dialog open; user can retry or cancel
        }
      }
    };

    return (
      <Dialog open={showNetworkPrompt} onClose={() => setShowNetworkPrompt(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Switch to Base Sepolia Testnet?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Power Wallet is not live on the <b>Base</b> mainnet chain yet, but you can experience an early version on the <b>Base Sepolia</b> Testnet.
            Do you want to switch to the Base Sepolia Testnet?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNetworkPrompt(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSwitchNetwork}>Switch Network</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <Navbar />
          <NetworkGuard />
          {children}
          <Footer />
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
