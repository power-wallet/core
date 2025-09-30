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
import Link from 'next/link';
import WalletConnectModal from './WalletConnectModal';

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Home', href: '/' },
    { text: 'Simulator', href: '/simulator' },
    { text: 'About', href: '/about' },
  ];

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={{ my: 2, fontWeight: 'bold' }}>
        Power Wallet
      </Typography>
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
        <ListItem disablePadding>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={() => setWalletModalOpen(true)}
            sx={{ mx: 2, my: 1 }}
          >
            Connect Wallet
          </Button>
        </ListItem>
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
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}
            
            <Typography
              variant="h6"
              component="div"
              sx={{ 
                flexGrow: isMobile ? 1 : 0,
                fontWeight: 'bold',
                background: 'linear-gradient(45deg, #F59E0B 30%, #FB923C 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mr: 4,
              }}
            >
              Power Wallet
            </Typography>

            {!isMobile && (
              <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
                {menuItems.map((item) => (
                  <Link key={item.text} href={item.href} passHref style={{ textDecoration: 'none' }}>
                    <Button color="inherit">
                      {item.text}
                    </Button>
                  </Link>
                ))}
              </Box>
            )}

            {!isMobile && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<AccountBalanceWalletIcon />}
                onClick={() => setWalletModalOpen(true)}
                sx={{
                  background: 'linear-gradient(45deg, #F59E0B 30%, #FB923C 90%)',
                  boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.39)',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
                  },
                }}
              >
                Connect Wallet
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
