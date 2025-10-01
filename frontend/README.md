# Power Wallet Frontend

A modern Web3 application for smart on-chain investing in Bitcoin and digital assets.

## Features

- 🔐 **Multi-Wallet Support**: Connect with MetaMask, WalletConnect, or Coinbase Smart Wallet
- 📱 **Responsive Design**: Works seamlessly on mobile, tablet, and desktop
- ⚡ **Fast & Modern**: Built with Next.js 15, React 19, and Material UI
- 🔗 **Web3 Ready**: Integrated with wagmi for blockchain interactions
- 🎨 **Beautiful UI**: Clean, professional design with Material UI components

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI Library**: Material UI (MUI) v6
- **Web3**: wagmi v2, viem, Coinbase Wallet SDK
- **State Management**: TanStack Query (React Query)
- **Styling**: Emotion (CSS-in-JS)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository and navigate to the frontend directory:
```bash
cd frontend
npm install
```

2. Create your environment file:
```bash
cp env.example .env.local
```

3. Get a WalletConnect Project ID:
   - Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
   - Create a new project
   - Copy your Project ID
   - Add it to `.env.local`:
     ```
     NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
     ```

4. Run the development server:
```bash
npm run dev
npm run dev:poll   # autoreload when source code changes
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── about/        # About page
│   │   ├── simulator/    # Strategy simulator (coming soon)
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Landing page
│   │   └── providers.tsx # Web3 providers
│   ├── components/       # React components
│   │   ├── Navbar.tsx    # Navigation bar
│   │   └── WalletConnectModal.tsx  # Wallet connection modal
│   ├── config/           # Configuration files
│   │   └── wagmi.ts      # Wagmi Web3 config
│   └── lib/              # Utilities and helpers
│       └── theme.ts      # MUI theme customization
├── public/               # Static assets
├── next.config.js        # Next.js configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Web3 Integration

The app supports multiple wallet options:

1. **Coinbase Smart Wallet** (Recommended for new users)
   - No browser extension needed
   - Create wallet with passkey
   - Best for onboarding

2. **MetaMask**
   - Browser extension required
   - Popular existing wallet

3. **WalletConnect**
   - Mobile wallet support
   - QR code connection

## Supported Networks

- **Base Sepolia** (Testnet)
- **Base Mainnet** (Production)

## Roadmap

- [x] Landing page with wallet connection
- [x] Responsive navigation
- [ ] Strategy simulator/backtester
- [ ] Wallet dashboard
- [ ] Strategy deployment interface
- [ ] Portfolio tracking
- [ ] Smart contract integration

## Contributing

This project is part of the Power Wallet ecosystem. For questions or suggestions, please open an issue.

## License

MIT
