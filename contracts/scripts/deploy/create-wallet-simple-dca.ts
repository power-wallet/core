// scripts/deploy/create-wallet-simple-dca.ts
import { ethers } from 'hardhat';
import { addresses } from '../../config/addresses';
import { WalletFactory__factory } from '../../typechain-types';

// WalletFactory (proxy): 0x6e6A4C1094a064030c30607549BF8d87311cB219
// StrategyRegistry (proxy): 0x53B4C7F51904b888f61859971B11ff51a8e43F80
// SimpleDCA: 0x316cc4fb12b1785aA38Cba5040AC2094B1d99709

async function main() {
  const [user] = await ethers.getSigners();
  console.log(`User: ${user.address}`);

  const chainKey = 'base-sepolia';
  const cfg = addresses[chainKey];

  // Addresses - provide deployed addresses here or load from env/args
  const factoryAddr = process.env.FACTORY_ADDR!;   // set before running

  const strategyId = ethers.id('simple-dca-v1');

  // Use TypeChain-typed factory for proper typings
  const factory = WalletFactory__factory.connect(factoryAddr, user);

  // Strategy init: initialize(address risk, address stable, uint256 amountStable, uint256 frequency, string desc)
  const oneUSDC = ethers.parseUnits('1', 6);
  const daily = 24 * 60 * 60;
  const desc = 'Simple DCA into cbBTC';
  const dcaInit = new ethers.Interface([
    'function initialize(address,address,uint256,uint256,string)'
  ]).encodeFunctionData('initialize', [cfg.cbBTC!, cfg.usdc, oneUSDC, daily, desc]);

  const poolFees: number[] = [];
  // configure fee for cbBTC (e.g., 100 for 0.01%)
  poolFees.push(100);

  const tx = await factory.createWallet(
    strategyId,
    dcaInit,
    cfg.usdc,
    [cfg.cbBTC!],
    [cfg.btcUsdPriceFeed],
    poolFees
  );
  const rc = await tx.wait();
  console.log('createWallet tx:', rc?.hash);

  // Fetch and print the newly created wallet address
  const wallets: string[] = await factory.getUserWallets(user.address);
  const newWallet = wallets[wallets.length - 1];
  console.log('New PowerWallet:', newWallet);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
