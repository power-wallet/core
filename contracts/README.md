# Base Sepolia Contract Addresses

- TechnicalIndicators: 0x7A0F3B371A2563627EfE1967E7645812909Eb6c5
- Strategy Registry: 0x53B4C7F51904b888f61859971B11ff51a8e43F80
- Wallet Factory: 0x6e6A4C1094a064030c30607549BF8d87311cB219
- Simple DCA Strategy: 0x316cc4fb12b1785aA38Cba5040AC2094B1d99709
- USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- cbBTC: 0xcbB7C0006F23900c38EB856149F799620fcb8A4a
- WETH: 0x4200000000000000000000000000000000000006
- UniswapV3 Factory: 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24
- UniswapV3 Router: 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
- Chainlink Price Feed BTC/USD: 0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298
- Chainlink Price Feed ETH/USD: 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1

---

## Quickstart

```bash
cd contracts
npm install
```

### Deploy TechnicalIndicators

```bash
npx hardhat run scripts/deploy/deploy_indicators.ts --network base-sepolia
```

### Verify TechnicalIndicators (Etherscan API v2)

```bash
# Ensure your ETHERSCAN_API_KEY is configured (Etherscan v2)
npx hardhat verify --network base-sepolia 0xfB1b64e658Cd1A7DdcEF9Cf263dFd800fc708987
```

### Backfill prices

```bash
npx hardhat run scripts/backfill-prices.ts --network base-sepolia
```

### Deploy StrategyRegistry, SimpleDCA, WalletFactory

```bash
npx hardhat run scripts/deploy/base-sepolia-deploy.ts --network base-sepolia
```

Example output:

```
Deployer: 0x9D4BA055ab6a40090E1C1bf8250F4319099B084b
Starting nonce: 41
StrategyRegistry (proxy): 0x53B4C7F51904b888f61859971B11ff51a8e43F80
SimpleDCA (template): 0x316cc4fb12b1785aA38Cba5040AC2094B1d99709
Registered strategy id: 0x786a403612fcd5da11e68ce2dace5caffe41cea41e2d64ff9998546517083dd3
WalletFactory (proxy): 0x6e6A4C1094a064030c30607549BF8d87311cB219
```

### Verify StrategyRegistry and WalletFactory Implementations

```bash
# get implementation addresses
npx hardhat console --network base-sepolia
> await upgrades.erc1967.getImplementationAddress("0x53B4C7F51904b888f61859971B11ff51a8e43F80")
> await upgrades.erc1967.getImplementationAddress("0x6e6A4C1094a064030c30607549BF8d87311cB219")

# verify with Etherscan v2 key configured
npx hardhat verify --network base-sepolia <strategyRegistryImpl>
npx hardhat verify --network base-sepolia <walletFactoryImpl>
```

### Create a new Wallet (via WalletFactory)

```bash
npx hardhat run scripts/deploy/create-wallet-simple-dca.ts --network base-sepolia
```

### Verify a new Wallet instance

```bash
npx hardhat verify --network base-sepolia \
  <walletAddress> \
  0x6e6A4C1094a064030c30607549BF8d87311cB219 \
  0x316cc4fb12b1785aA38Cba5040AC2094B1d99709
```

### Upgrade WalletFactory (and PowerWallet)

```bash
npx hardhat run scripts/upgrade/upgrade_wallet_factory.ts --network base-sepolia
```

### Deploy and Verify PowerWallet implementation

PowerWallet is deployed/cloned by WalletFactory, but we deploy & verify once so new instances verify automatically.

```bash
npx hardhat run scripts/deploy/deploy_power_wallet_impl.ts --network base-sepolia
npx hardhat verify --network base-sepolia <powerWalletImpl>
```

---

Notes:
- Use Etherscan API v2 (set `ETHERSCAN_API_KEY`) to avoid deprecated v1 warnings.
- Addresses above are for Base Sepolia testnet and reflect the current state of this repo.
