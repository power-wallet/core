# Power Wallet

Power Wallet is an on-chain smart investing wallet that helps users automate dollar-cost averaging and strategy-driven portfolio management using modular, upgradable smart contracts and a modern web frontend.

- Contracts are written in Solidity (Hardhat) with Chainlink integrations and Uniswap v3 execution.
- Frontend is a Next.js + React app using wagmi/viem for wallet connectivity and transactions.

## Monorepo layout

- `contracts/` — Solidity sources, Hardhat config, deployment/upgrade scripts, and tests
  - See `contracts/README.md` for deployed addresses and developer notes
- `frontend/` — Next.js application (app router), UI components, pages, and blockchain interactions

## Quickstart

### Contracts

```bash
cd contracts
npm install
# Example: deploy to Base Sepolia
npx hardhat run scripts/deploy/base-sepolia-deploy.ts --network base-sepolia
```

Useful references are documented in `contracts/README.md` (addresses, verify commands, and upgrade flows).

### Frontend

```bash
cd frontend
npm install
npm run dev
# open http://localhost:3000
```

The frontend currently supports Base and Base Sepolia. If you connect on a different chain, the app prompts you to switch to Base Sepolia and will help you add the network if your wallet doesn’t have it configured. Network handling and names are centralized in `src/lib/web3.ts` and `src/config/wagmi.ts`.

If you need testnet USDC on Base Sepolia, you can use the Circle faucet: https://faucet.circle.com/

## Core features

- Strategy registry and factory for creating user wallets
- Simple DCA strategy (USDC -> cbBTC on Uniswap v3)
- Chainlink price feed integrations and optional Automation support
- Upgradable architecture for contracts
- Wallet UX with network guard, transaction helpers, and portfolio views

## Links

- GitHub organization: https://github.com/orgs/power-wallet/repositories
- Telegram: https://t.me/power_wallet_finance
- Faucet (USDC testnet): https://faucet.circle.com/

## Notes for contributors

- Prefer Base Sepolia for development and demos
- Keep chain additions centralized (`frontend/src/config/networks.ts` and `frontend/src/lib/web3.ts`)
- Before sending transactions, ensure chain preflight checks are in place (use the shared helpers)

---

© Power Wallet. All rights reserved.
