# Base Sepolia Contract Addresses

TechnicalIndicators deployed to: 0x7A0F3B371A2563627EfE1967E7645812909Eb6c5


# TechnicalIndicators Deployment 

```
cd /Users/carlo/dev/tradingstrategy/contracts
npx hardhat run scripts/deploy/deploy_indicators.ts --network base-sepolia

----

Deploying TechnicalIndicators to base-sepolia...
Loading historical price data...
Deployment parameters:
- Tokens: [
  '0xcbB7C0006F23900c38EB856149F799620fcb8A4a',
  '0x4200000000000000000000000000000000000006'
]
- Price Feeds: [
  '0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298',
  '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1'
]
- Start Time: 2025-03-13T00:00:00.000Z
- End Date: 2025-09-28
- Historical Data Points: 200
- First BTC Price: 81066.7014
- First ETH Price: 1862.9696

TechnicalIndicators deployed to: 0x7A0F3B371A2563627EfE1967E7645812909Eb6c5
Implementation deployed to: 0xfB1b64e658Cd1A7DdcEF9Cf263dFd800fc708987
Admin address: 0x0000000000000000000000000000000000000000

Verifying initial data...
Latest BTC price in contract: 112122.6392
Latest ETH price in contract: 4141.4765


Verifying implementation contract...
[WARNING] Network and explorer-specific api keys are deprecated in favour of the new Etherscan v2 api. Support for v1 is expected to end by May 31st, 2025. To migrate, please specify a single Etherscan.io api key the apiKey config value.
Verification failed: HardhatVerifyError: You are using a deprecated V1 endpoint, switch to Etherscan API V2 using https://docs.etherscan.io/v2-migration

```


## Implementation Verificaton

```
npx hardhat verify --network base-sepolia 0xfB1b64e658Cd1A7DdcEF9Cf263dFd800fc708987

```

## Backfill prices


```
npx hardhat run scripts/backfill-prices.ts --network base-sepolia

```

## Deploy StrategyRegistry, SimpleDCA, WalletFactory
```
$ npx hardhat run scripts/deploy/base-sepolia-deploy.ts --network base-sepolia

Deployer: 0x9D4BA055ab6a40090E1C1bf8250F4319099B084b
Starting nonce: 41
StrategyRegistry (proxy): 0x53B4C7F51904b888f61859971B11ff51a8e43F80
SimpleDCA (template): 0x316cc4fb12b1785aA38Cba5040AC2094B1d99709
Registered strategy id: 0x786a403612fcd5da11e68ce2dace5caffe41cea41e2d64ff9998546517083dd3
WalletFactory (proxy): 0x6e6A4C1094a064030c30607549BF8d87311cB219
```

## Verity contracts

```
# verify SimpleDCA
npx hardhat verify --network base-sepolia 0x316cc4fb12b1785aA38Cba5040AC2094B1d99709

npx hardhat console --network base-sepolia
> await upgrades.erc1967.getImplementationAddress("0x53B4C7F51904b888f61859971B11ff51a8e43F80")
'0xF6844ec320eed359A766418a244249F5aaC2b695'
> await upgrades.erc1967.getImplementationAddress("0x6e6A4C1094a064030c30607549BF8d87311cB219")
'0xA27B80dCD4490E11aCd53148c69bB62c9fcEEB9a'
> 

# verify StrategyRegistry and WalletFactory
npx hardhat verify --network base-sepolia 0xF6844ec320eed359A766418a244249F5aaC2b695
npx hardhat verify --network base-sepolia 0xA27B80dCD4490E11aCd53148c69bB62c9fcEEB9a

npx hardhat verify --network base-sepolia 0xA27B80dCD4490E11aCd53148c69bB62c9fcEEB9a
```

## Craete Wallet

```
npx hardhat run contracts/scripts/deploy/create-wallet-simple-dca.ts --network base-sepolia

Wallet created: 0x3111a201009dF11b1b8D95d03696f83b444a403e
```

# Verify Wallet

```
npx hardhat verify --network base-sepolia \
  0x3111a201009dF11b1b8D95d03696f83b444a403e \
  0x6e6A4C1094a064030c30607549BF8d87311cB219 \
  0x316cc4fb12b1785aA38Cba5040AC2094B1d99709
```