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
import { switchOrAddPrimaryChain, isOnPrimaryAppChain, getFriendlyChainName } from '@/lib/web3';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [showNotice, setShowNotice] = useState(true);
  const dismissNotice = () => { setShowNotice(false); };

  function NetworkGuard() {
    const { isConnected } = useAccount();
    const currentChainId = useChainId();
    const { switchChainAsync } = useSwitchChain();
    const [showNetworkPrompt, setShowNetworkPrompt] = useState(false);

    useEffect(() => {
      if (isConnected && currentChainId && !isOnPrimaryAppChain(currentChainId)) {
        setShowNetworkPrompt(true);
      } else {
        setShowNetworkPrompt(false);
      }
    }, [isConnected, currentChainId]);

    const handleSwitchNetwork = async () => {
      const ok = await switchOrAddPrimaryChain((args: any) => switchChainAsync(args as any));
      if (ok) setShowNetworkPrompt(false);
    };

    return (
      <Dialog open={showNetworkPrompt} onClose={() => setShowNetworkPrompt(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Switch to Base Sepolia Testnet?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Power Wallet is not live on the <b>Base</b> mainnet chain yet, but you can experience an early version on the <b>Base Sepolia</b> Testnet. <br />
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
          {showNotice && (
            <div style={{ width: '100%', position: 'relative', background: 'rgb(135, 56, 56)', color: '#FFFFFF', fontSize: 12, padding: '6px 32px 6px 12px', textAlign: 'center', borderBottom: '1px solid rgba(239, 68, 68, 0.25)' }}>
              This project is in early development and available for demo on the Base Sepolia testnet.
              <button aria-label="Dismiss" onClick={dismissNotice} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#FECACA', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>
                ×
              </button>
            </div>
          )}
          <Navbar />
          <NetworkGuard />
          {children}
          <Footer />
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
