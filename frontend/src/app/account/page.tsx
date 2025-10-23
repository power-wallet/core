'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  IconButton,
  Snackbar,
  Alert,
  Link as MuiLink,
} from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAccount, useChainId, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import appConfig from '@/config/appConfig.json';
import { getChainKey } from '@/config/networks';
import { addresses as contractAddresses } from '@/../../contracts/config/addresses';

const ERC20_ABI = [
  { type: 'function', stateMutability: 'view', name: 'balanceOf', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', stateMutability: 'nonpayable', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

function formatNumber(n: number, maxFrac = 4) {
  return n.toLocaleString('en-US', { maximumFractionDigits: maxFrac });
}

export default function AccountPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const chainKey = getChainKey(chainId);
  const cfg = (appConfig as any)[chainKey] || {};
  const addrChain = (contractAddresses as any)[chainKey] || {};
  const usdcAddress: `0x${string}` | undefined = addrChain?.usdc || undefined;
  const usdcDecimals: number = Number(((cfg?.assets || {}).USDC || {}).decimals || 6);

  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: Boolean(isConnected && usdcAddress && address),
    },
  });

  const balanceBig = (balanceData as unknown as bigint) || 0n;
  const balanceNumber = Number(balanceBig) / 10 ** usdcDecimals;
  const balanceText = useMemo(() => formatNumber(balanceNumber, 6), [balanceNumber]);

  const [sendOpen, setSendOpen] = useState(false);
  const [recvOpen, setRecvOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const explorerTxBase = `${String(cfg?.explorer || '')}/tx/`;

  const handleMax = () => {
    setAmount(String(balanceNumber));
  };

  const handleSend = async () => {
    try {
      if (!isConnected || !usdcAddress) return;
      const amt = Number(amount);
      if (!recipient || !amt || amt <= 0) return;
      const amtBig = BigInt(Math.floor(amt * 10 ** usdcDecimals));
      if (amtBig > balanceBig) return;
      const hash = await writeContractAsync({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amtBig],
      });
      setTxHash(hash as string);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      }
      // Refresh balance and show snackbar
      await refetchBalance();
      setSnackbarOpen(true);
      setSendOpen(false);
      setRecipient('');
      setAmount('');
    } catch (_) {
      // ignore
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '60vh', py: 4 }}>
      <Container maxWidth="sm">
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">Account</Typography>
          <Typography variant="body2" color="text.secondary">Manage your USDC on the connected wallet</Typography>
        </Box>

        <Card sx={{ bgcolor: '#1A1A1A', border: '1px solid #2D2D2D' }}>
          <CardContent sx={{ p: 3 }}>
            {!isConnected ? (
              <Typography variant="body2" color="text.secondary">Connect a wallet to view balance.</Typography>
            ) : !usdcAddress ? (
              <Typography variant="body2" color="text.secondary">USDC is not configured for this network.</Typography>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'flex-end', gap: 1 }}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">USDC Balance</Typography>
                    <Typography variant="h5" fontWeight="bold">{balanceText} USDC</Typography>
                  </Box>
                  <Button variant="outlined" startIcon={<SendRoundedIcon />} onClick={() => setSendOpen(true)}>Send</Button>
                  <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => setRecvOpen(true)}>Receive</Button>
                </Box>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={sendOpen} onClose={() => setSendOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ pr: 6 }}>
            Send USDC
            <IconButton
              aria-label="close"
              onClick={() => setSendOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseRoundedIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Recipient Address"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                fullWidth
              />

              <TextField
                label="Amount"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                fullWidth
              />
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Balance: {balanceText} USDC</Typography>
                <Button size="small" onClick={handleMax}>Max</Button>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ pb: 2, pr: 4 }}>
            <Button variant="contained" size="large" onClick={handleSend} disabled={isPending || !recipient || !amount}>Send</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
            Payment sent. {txHash ? (
              <MuiLink href={`${explorerTxBase}${txHash}`} target="_blank" rel="noopener noreferrer" sx={{ color: '#60A5FA', ml: 0.5 }}>
                View on explorer
              </MuiLink>
            ) : null}
          </Alert>
        </Snackbar>

        <Dialog open={recvOpen} onClose={() => setRecvOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle sx={{ pr: 6 }}>
            Receive USDC
            <IconButton
              aria-label="close"
              onClick={() => setRecvOpen(false)}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseRoundedIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {address ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(address)}`}
                  alt="Wallet address QR"
                  width={180}
                  height={180}
                />
              </Box>
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Your address</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center' }}>
              <TextField value={address || ''} InputProps={{ readOnly: true }} fullWidth />
              <Button
                variant="outlined"
                startIcon={<ContentCopyRoundedIcon />}
                onClick={() => { if (address) navigator.clipboard.writeText(address); }}
              >Copy</Button>
            </Box>
          </DialogContent>
        </Dialog>
      </Container>
    </Box>
  );
}


