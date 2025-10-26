import { createConfig, http } from 'wagmi';
import { baseSepolia, base, mainnet, sepolia } from 'wagmi/chains';
import appConfig from '@/config/appConfig.json';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

// Get WalletConnect project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Build connectors array - only include WalletConnect if we have a valid project ID
const connectors = [
  injected({ target: 'metaMask' }),
  coinbaseWallet({
    appName: 'Power Wallet',
    appLogoUrl: 'https://powerwallet.finance/img/logo.png',
    preference: 'smartWalletOnly', // Enable Smart Wallet by default
  }),
];

// Only add WalletConnect if we have a valid project ID
if (projectId && projectId !== 'placeholder_get_from_walletconnect') {
  connectors.push(
    walletConnect({
      projectId,
      metadata: {
        name: 'Power Wallet',
        description: 'Trading Strategy Simulator',
        url: 'https://powerwallet.finance',
        icons: ['https://powerwallet.finance/img/logo.png']
      },
      showQrModal: true
    }) as any // Type assertion to bypass version mismatch
  );
}

export const config = createConfig({
  chains: [baseSepolia, base, mainnet, sepolia],
  connectors,
  transports: {
    [baseSepolia.id]: ((appConfig as any)['base-sepolia']?.rpcUrl ? http((appConfig as any)['base-sepolia']?.rpcUrl) : http()),
    [base.id]: ((appConfig as any)['base']?.rpcUrl ? http((appConfig as any)['base']?.rpcUrl) : http()),
    [sepolia.id]: http(),
    [mainnet.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
