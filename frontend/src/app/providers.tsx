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
import { switchOrAddPrimaryChain, isSupportedChain } from '@/lib/web3';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base, baseSepolia } from 'wagmi/chains';
import '@coinbase/onchainkit/styles.css';

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
      if (isConnected && currentChainId && !isSupportedChain(currentChainId)) {
        setShowNetworkPrompt(true);
      } else {
        setShowNetworkPrompt(false);
      }
    }, [isConnected, currentChainId]);

    const handleSwitchToSepolia = async () => {
      const ok = await switchOrAddPrimaryChain((args: any) => switchChainAsync(args as any));
      if (ok) setShowNetworkPrompt(false);
    };

    const handleSwitchToBase = async () => {
      try {
        await switchChainAsync({ chainId: base.id });
        setShowNetworkPrompt(false);
      } catch (_) {
        // no-op; user can still switch via wallet UI
      }
    };

    return (
      <Dialog open={showNetworkPrompt} onClose={() => setShowNetworkPrompt(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Switch network?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Power Wallet supports <b>Base</b> (mainnet) for fiat onramp and <b>Base Sepolia</b> for testnet demo. Choose a network to switch to.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNetworkPrompt(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSwitchToBase}>Switch to Base Mainnet</Button>
          <Button variant="outlined" onClick={handleSwitchToSepolia}>Switch to Base Sepolia</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <OnchainKitProvider
            chain={base}
            apiKey={process.env.NEXT_PUBLIC_CDP_API_KEY}
            projectId={process.env.NEXT_PUBLIC_CDP_PROJECT_ID}
            config={{
              appearance: {
                name: 'Power Wallet',
                logo: '/img/logo/logo.png',
                mode: 'auto',
                theme: 'default',
              },
              wallet: {
                display: 'modal',
                termsUrl: 'https://powerwallet.finance/terms',
                privacyUrl: 'https://powerwallet.finance/privacy',
              },
            }}
          >
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
          </OnchainKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
