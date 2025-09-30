# Base Sepolia Contract Addresses

TechnicalIndicators deployed to: 0xC5D8030DF3BED5A63Ad492cbC466128FFacd0e07
Implementation deployed to: 0xfB1b64e658Cd1A7DdcEF9Cf263dFd800fc708987
Admin address: 0x0000000000000000000000000000000000000000

# Deployment 

```
cd /Users/carlo/dev/tradingstrategy/contracts
npx hardhat run scripts/deploy/01_deploy_indicators.ts --network base-sepolia

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