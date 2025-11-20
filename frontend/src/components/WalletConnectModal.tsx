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
  Tooltip,
  Snackbar,
  Alert,
  Grid
} from '@mui/material';

import { getOnrampBuyUrl, getCoinbaseSmartWalletFundUrl, fetchOnrampConfig, setupOnrampEventListeners } from '@coinbase/onchainkit/fund';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AddIcon from '@mui/icons-material/Add';
import { useConnect, useAccount, useDisconnect, useChainId, useSwitchChain, useBalance, useSignMessage } from 'wagmi';
import { getChainKey } from '@/config/networks';
import { baseSepolia, base } from 'wagmi/chains';
import { getFriendlyChainName, switchOrAddPrimaryChain } from '@/lib/web3';
import { getViemChain } from '@/config/networks';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';
import { ERC20_READ_ABI } from '@/lib/abi';
import { createPublicClient, http } from 'viem';

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
}

const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ open, onClose }) => {
  const { connect, connectors, isPending } = useConnect();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const [copied, setCopied] = React.useState(false);
  const [usdc, setUsdc] = React.useState<bigint | null>(null);
  const [usdcDecimals, setUsdcDecimals] = React.useState<number>(6);
  const [reloadNonce, setReloadNonce] = React.useState<number>(0);
  const [errorToast, setErrorToast] = React.useState<string | null>(null);
  // removed extra funding modal; we open popup directly

  const { data: nativeBal } = useBalance({ address: (address || undefined) as `0x${string}` | undefined, chainId });

  React.useEffect(() => {
    let cancelled = false;
    async function readUsdc() {
      try {
        if (!address) return;
        const chainKey = getChainKey(chainId);
        const usdcAddr = (contractAddresses as any)[chainKey]?.usdc as `0x${string}` | undefined;
        if (!usdcAddr) return;
        const chain = getViemChain(chainId);
        const client = createPublicClient({ chain, transport: http() });
        const [bal, dec] = await Promise.all([
          client.readContract({ address: usdcAddr, abi: ERC20_READ_ABI as any, functionName: 'balanceOf', args: [address as `0x${string}`] }) as Promise<bigint>,
          client.readContract({ address: usdcAddr, abi: ERC20_READ_ABI as any, functionName: 'decimals', args: [] }) as Promise<number>,
        ]);
        if (!cancelled) { setUsdc(bal); setUsdcDecimals(dec ?? 6); }
      } catch { }
    }
    readUsdc();
    return () => { cancelled = true; };
  }, [address, chainId, reloadNonce]);

  const formatEth = (wei?: bigint) => {
    if (wei == null) return '-';
    // 18 decimals
    const s = Number(wei) / 1e18;
    return s.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const formatUsdc = (amt?: bigint | null) => {
    if (amt == null) return '-';
    const s = Number(amt) / Math.pow(10, usdcDecimals || 6);
    return s.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const networkName = React.useMemo(() => getFriendlyChainName(chainId), [chainId]);

  const handleSwitchNetwork = async () => {
    await switchOrAddPrimaryChain((args: any) => switchChainAsync(args as any));
  };

  const toggleBaseNetwork = async () => {
    try {
      const target = chainId === baseSepolia.id ? base : baseSepolia;
      await switchChainAsync({ chainId: target.id });
    } catch {}
  };

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
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            backgroundImage: 'none',
            mx: { xs: 1, sm: 2 },
            width: { xs: 'calc(100% - 16px)', sm: 'auto' },
          }
        }}
      >
        <DialogTitle sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1.25, sm: 2 } }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" component="div" fontWeight="bold">
              {isConnected ? 'Connected Wallet' : 'Connect Wallet'}
            </Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: { xs: 1.5, sm: 3 }, pt: { xs: 1.25, sm: 2 }, pb: { xs: 2, sm: 3 } }}>
          {isConnected ? (
            <Box>
              <Card variant="outlined" sx={{ mb: 2, p: 0 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Connected Address
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {address}   &nbsp;                
                      <Tooltip title="Copy address">
                        <IconButton size="small" onClick={async () => { if (address) { await navigator.clipboard.writeText(address); setCopied(true); } }} aria-label="Copy address">
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Typography>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', gap: 0, flexWrap: 'wrap', alignItems: 'flex-start'}}>
                    <Box sx={{ mt: { xs: 1, sm: 0 }, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {networkName && (
                        <Box sx={{ minWidth: 240 }}>
                          <Typography variant="subtitle2" color="text.secondary">Balances</Typography>
                          <Stack direction={{ xs: 'row', sm: 'row' }} spacing={2} sx={{ mt: 0.5 }}>
                            <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 120 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatEth(nativeBal?.value)}</Typography>
                              <Typography variant="body2" color="text.secondary">ETH</Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 120 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatUsdc(usdc)}</Typography>
                              <Typography variant="body2" color="text.secondary">USDC</Typography>
                            </Stack>

                            {isConnected && chainId === base.id && (
                              <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 120 }}>
                                <Box sx={{ mt: 2 }}>
                                  <Button
                                    variant="contained"
                                    size="small"
                                    onClick={async () => {
                                      try {
                                        // 1) Sign a short-lived authorization message
                                        const origin = window.location.origin;
                                        const ts = Math.floor(Date.now() / 1000);
                                        const message = `PowerWallet Onramp Authorization; origin=${origin}; ts=${ts}; address=${address}`;
                                        const signature = await signMessageAsync({ message });

                                        // Open a placeholder popup after signing (before backend requests) to minimize overlap with wallet UI
                                        const w = 480, h = 720;
                                        const dualScreenLeft = window.screenLeft ?? (window as any).screenX ?? 0;
                                        const dualScreenTop = window.screenTop ?? (window as any).screenY ?? 0;
                                        const width = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
                                        const height = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;
                                        const left = Math.max(0, (width - w) / 2 + dualScreenLeft);
                                        const top = Math.max(0, (height - h) / 2 + dualScreenTop);
                                        let pendingPopup: Window | null = window.open(
                                          '',
                                          '_blank',
                                          `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`
                                        );
                                        try { pendingPopup?.document.write('<div style="font-family:system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif; padding:16px;">Opening Coinbase Onramp...</div>'); } catch {}

                                        // 2) Mint app JWT from backend
                                        const mintResp = await fetch('/.netlify/functions/mint-app-jwt', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ address, message, signature, expSec: 300 }),
                                        });
                                        if (!mintResp.ok) {
                                          console.warn('Failed to mint app JWT:', mintResp.statusText, 'status:', mintResp.status);
                                          setErrorToast('Could not authorize purchase. Please try again.');
                                          return;
                                        }
                                        const mintJson = await mintResp.json();
                                        const token = (mintJson as any)?.token as string | undefined;
                                        if (!token) {
                                          console.warn('Mint-app-jwt: missing token in response');
                                          setErrorToast('Authorization token missing. Please try again.');
                                          return;
                                        }

                                        // 3) Create server-side v2 session to get Hosted UI onrampUrl
                                        const resp = await fetch('/.netlify/functions/create-onramp-session', {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`,
                                          },
                                          body: JSON.stringify({
                                            address,
                                            fiatCurrency: (Intl.NumberFormat().resolvedOptions().currency || '').toUpperCase(),
                                            partnerUserRef: address ? `${address}:${ts}` : undefined,
                                          }),
                                        });
                                        if (!resp.ok) {
                                          console.warn('Failed to create onramp session:', resp.statusText, "status:", resp.status);
                                          setErrorToast('Failed to create onramp session. Please try again.');
                                          return;
                                        }
                                         const json = await resp.json();
                                        let url = (json as any)?.onrampUrl as string | undefined;
                                        if (url) {
                                          console.log('Created onramp session: url:', url, "resp:", json);
                                        }
                                        if (!url) {
                                          console.warn('Failed to create onramp session: no onrampUrl');
                                          setErrorToast('Onramp URL not available. Please try again.');
                                          // // Fallback to token flow if function is older
                                          // const token = (json as any)?.sessionToken as string | undefined;
                                          // if (!token) {
                                          //   console.warn('Failed to create onramp session: no sessionToken');
                                          // }
                                          // url = token ? getOnrampBuyUrl({ sessionToken: token, defaultAsset: 'USDC', defaultNetwork: 'base', originComponentName: 'PowerWallet' }) : undefined;
                                          // Close placeholder popup if it was opened
                                          try { pendingPopup?.close(); } catch {}
                                          pendingPopup = null;
                                          return;
                                        }
                                         // if (!url) {
                                         //   url = getCoinbaseSmartWalletFundUrl();
                                         // }
                                         const unsubscribe = setupOnrampEventListeners({
                                          onSuccess: () => { setReloadNonce((n) => n + 1); },
                                          onExit: () => {},
                                          onEvent: () => {},
                                        });
                                         // Reuse placeholder popup if available; otherwise try opening a new one
                                         let popup: Window | null = pendingPopup;
                                         if (popup) {
                                           try { popup.location.href = url; } catch { popup = null; }
                                         }
                                         if (!popup) {
                                           popup = window.open(
                                             url,
                                             '_blank',
                                             `scrollbars=yes,width=${w},height=${h},top=${top},left=${left}`
                                           );
                                         }
                                         if (popup) {
                                          const interval = window.setInterval(() => {
                                            if (popup.closed) {
                                              window.clearInterval(interval);
                                              try { unsubscribe?.(); } catch {}
                                              setReloadNonce((n) => n + 1);
                                            }
                                          }, 750);
                                         } else {
                                           setErrorToast('Popup was blocked. Please allow popups for this site and try again.');
                                        }
                                      } catch {}
                                    }}
                                  >
                                    Buy USDC
                                  </Button>
                                </Box>
                              </Stack>
                            )}

                          </Stack>
                        </Box>
                      )}
                    </Box>

                  </Box>

                  <Box sx={{ mt: 4, display: 'flex', gap: 3, flexWrap: 'wrap' , alignContent: 'center'}}>
                      {networkName && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary">
                            Network
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, alignContent: 'center', alignItems: 'baseline' }}>
                            <Typography variant="body2">
                              {networkName}
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                              {chainId && chainId == baseSepolia.id && (
                                <Button size="small" variant="outlined" startIcon={<SwapHorizIcon fontSize="small" />} onClick={toggleBaseNetwork}>
                                  {chainId === baseSepolia.id ? 'Switch to Base Mainnet' : 'Switch to Base Sepolia'}
                                </Button>
                              )}
                            </Box>
                          </Box>
                        </Box>
                    )}
                  </Box>

                  {chainId && chainId !== baseSepolia.id && (
                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        bgcolor: 'rgba(245, 158, 11, 0.1)',
                        borderRadius: 1,
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                      }}
                    >
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        You&apos;re connected to {networkName}. <br /> Power Wallet is available for early preview on Base Sepolia.
                      </Typography>
                      <Button variant="contained" size="small" onClick={handleSwitchNetwork}>
                        Switch to Base Sepolia
                      </Button>
                    </Box>
                  )}
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
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: 1,
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                }}
              >
                <Typography variant="caption" sx={{ color: '#FBB042' }}>
                  💡 <strong>New to crypto?</strong> Choose <b>Coinbase Smart Wallet</b> to create a wallet instantly with just your passkey -
                  no extensions or recovery phrases needed, and <b>no gas fees</b>!
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Choose how you want to connect:
              </Typography>

              {[...connectors].sort((a, b) => (a.id === 'coinbaseWalletSDK' ? -1 : b.id === 'coinbaseWalletSDK' ? 1 : 0)).map((connector) => (
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


            </Stack>
          )}
        </DialogContent>
      </Dialog>
      {/* No extra onramp modal; popup is opened directly */}
      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setCopied(false)} severity="success" sx={{ width: '100%' }}>
          Address copied to clipboard
        </Alert>
      </Snackbar>
      <Snackbar open={!!errorToast} autoHideDuration={3500} onClose={() => setErrorToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setErrorToast(null)} severity="error" sx={{ width: '100%' }}>
          {errorToast}
        </Alert>
      </Snackbar>
    </>
  );
};

export default WalletConnectModal;
