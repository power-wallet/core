'use client';

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Box,
  useMediaQuery,
  useTheme,
  Container,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useAccount, useChainId } from 'wagmi';
import { getChainKey } from '@/config/networks';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import WalletConnectModal from './WalletConnectModal';
import LogoIcon from './LogoIcon';

const Navbar = () => {
  const Jazzicon = dynamic(() => import('react-jazzicon'), { ssr: false });
  const jsNumberForAddress = (address: string) => {
    try {
      return parseInt(address.slice(2, 10), 16);
    } catch {
      return 0;
    }
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const isBaseSepolia = chainId === 84532;
  const pathname = usePathname();
  const showConnect = pathname !== '/';
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const shortAddress = React.useMemo(() => {
    if (!address) return '';
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }, [address]);

  // Jazzicon provides MetaMask-style avatars

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'My Wallets', href: '/portfolio' },
    { text: 'Simulator', href: '/simulator' },
    { text: 'Smart Contracts', href: '/contracts' },
    { text: 'About', href: '/about' },
  ];

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Link href="/" passHref style={{ textDecoration: 'none', color: 'inherit' }}>
        <Typography variant="h6" sx={{ my: 2, fontWeight: 'bold' }}>
          Power Wallet
        </Typography>
      </Link>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <Link href={item.href} passHref style={{ width: '100%', textDecoration: 'none', color: 'inherit' }}>
              <ListItemText 
                primary={item.text} 
                sx={{ textAlign: 'center', py: 1 }}
              />
            </Link>
          </ListItem>
        ))}
        {mounted && isConnected && isBaseSepolia ? (
          <ListItem disablePadding>
            <Link href="/faucet" passHref style={{ width: '100%', textDecoration: 'none', color: 'inherit' }}>
              <ListItemText 
                primary="Faucet" 
                sx={{ textAlign: 'center', py: 1 }}
              />
            </Link>
          </ListItem>
        ) : null}
        {showConnect && mounted && (
          <ListItem disablePadding>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              startIcon={isConnected && address ? (
                <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Jazzicon diameter={16} seed={jsNumberForAddress(address)} />
                </Box>
              ) : (
                <AccountBalanceWalletIcon />
              )}
              onClick={() => setWalletModalOpen(true)}
              sx={{ mx: 2, my: 1 }}
            >
              {isConnected ? shortAddress : 'Connect Wallet'}
            </Button>
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar 
        position="sticky" 
        elevation={2}
        sx={{
          backgroundColor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 0, mt: 0, display: { xs: 'inline-flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            
            <Link href="/" passHref style={{ textDecoration: 'none', color: 'inherit' }}>
              <Box sx={{ flexGrow: 0, display: { xs: 'none', md: 'inline-flex' }, alignItems: 'center', justifyContent: 'center', mr: 2, lineHeight: 0, alignSelf: 'center' }} aria-label="Go to homepage">
                <LogoIcon size={28} />
              </Box>
            </Link>

            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 2 }}>
              {menuItems.map((item) => (
                <Link key={item.text} href={item.href} passHref style={{ textDecoration: 'none' }}>
                  <Button 
                    sx={{ 
                      color: 'white',
                      '&:hover': {
                        color: 'primary.main',
                        bgcolor: 'rgba(245, 158, 11, 0.1)',
                      },
                    }}
                  >
                    {item.text}
                  </Button>
                </Link>
              ))}
              {mounted && isConnected && isBaseSepolia ? (
                <Link href="/faucet" passHref style={{ textDecoration: 'none' }}>
                  <Button 
                    sx={{ 
                      color: 'white',
                      '&:hover': {
                        color: 'primary.main',
                        bgcolor: 'rgba(245, 158, 11, 0.1)',
                      },
                    }}
                  >
                    Faucet
                  </Button>
                </Link>
              ) : null}
            </Box>

            {showConnect && mounted && (
              <Button
                variant="contained"
                color="primary"
                startIcon={isConnected && address ? (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Jazzicon diameter={20} seed={jsNumberForAddress(address)} />
                  </Box>
                ) : (
                  <AccountBalanceWalletIcon />
                )}
                onClick={() => setWalletModalOpen(true)}
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  background: 'linear-gradient(45deg, #F59E0B 30%, #FB923C 90%)',
                  boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.39)',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
                  },
                }}
              >
                {isConnected ? shortAddress : 'Connect Wallet'}
              </Button>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
        }}
      >
        {drawer}
      </Drawer>

      <WalletConnectModal 
        open={walletModalOpen} 
        onClose={() => setWalletModalOpen(false)} 
      />
    </>
  );
};

export default Navbar;
