# Power Wallet Setup Guide

## Quick Start

The app is ready to run! You can use MetaMask and Coinbase Smart Wallet without any additional configuration.

```bash
npm run dev
```

Visit: http://localhost:3000

## Optional: WalletConnect Setup

If you want to enable WalletConnect support for mobile wallets, follow these steps:

### 1. Get a WalletConnect Project ID (Free)

1. Go to https://cloud.walletconnect.com/
2. Click "Sign In" or "Create Account"
3. Create a new project:
   - Click "Create" or "New Project"
   - Enter project name: "Power Wallet"
   - Select project type: "App"
4. Copy your **Project ID**

### 2. Add to Environment Variables

Open `.env.local` and replace the placeholder:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_actual_project_id_here
```

### 3. Restart Dev Server

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

Now WalletConnect will be available in the wallet connection modal!

## What Works Without WalletConnect

- ✅ **MetaMask** (browser extension)
- ✅ **Coinbase Smart Wallet** (no extension needed, passkey-based)
- ❌ **WalletConnect** (requires Project ID)

## Troubleshooting

### "Project ID Not Configured" Warning

This is normal if you haven't set up WalletConnect yet. The app will still work with MetaMask and Coinbase Smart Wallet.

### MUI Theme Errors

If you see errors about functions in client components, make sure:
- The `Providers` component has `'use client'` at the top
- Material UI providers are in the client component, not the layout

### Connection Issues

- Make sure MetaMask is installed for MetaMask support
- Coinbase Smart Wallet works in any modern browser
- Check that you're on the right network (Base Sepolia or Base)

## Next Steps

Once you have the app running:
1. Click "Connect Wallet" in the navigation
2. Try connecting with Coinbase Smart Wallet (easiest)
3. Explore the landing page, simulator, and about sections
4. Start building the wallet dashboard and strategy interfaces!
