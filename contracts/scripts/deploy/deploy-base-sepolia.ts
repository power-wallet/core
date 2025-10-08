// scripts/deploy/base-sepolia-deploy.ts
import { ethers, upgrades } from 'hardhat';
import { addresses } from '../../config/addresses';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const chainKey = 'base-sepolia';
  const cfg = addresses[chainKey];
  if (!cfg) throw new Error(`No config for ${chainKey}`);

  // Robust nonce/fee management: use pending nonce and unique per-tx fee bumps
  const startNonce = await ethers.provider.getTransactionCount(deployer.address, 'pending');
  let next = startNonce;
  console.log('Starting nonce:', startNonce);
  
  const fee = await ethers.provider.getFeeData();
  const basePri = fee.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const baseMax = fee.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');
  const nextOverrides = () => {
    const i = BigInt(next - startNonce + 1);
    next++; // advance local counter for unique fee bumps
    return {
      maxPriorityFeePerGas: basePri + i * ethers.parseUnits('1', 'gwei'),
      maxFeePerGas: baseMax + i * ethers.parseUnits('2', 'gwei'),
    };
  };

  // Deploy StrategyRegistry (UUPS)
  const StrategyRegistry = await ethers.getContractFactory('StrategyRegistry');
  const registry = await upgrades.deployProxy(StrategyRegistry, [deployer.address], { kind: 'uups', txOverrides: nextOverrides() });
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log('StrategyRegistry (proxy):', registryAddr);

  // Deploy SimpleDCA implementation template (not proxy)
  const SimpleDCA = await ethers.getContractFactory('SimpleDCA');
  const dca = await SimpleDCA.deploy(nextOverrides());
  await dca.waitForDeployment();
  console.log('SimpleDCA (template):', await dca.getAddress());

  // Register strategy id (updated canonical id)
  const strategyId = ethers.id('simple-btc-dca-v1');
  await (await registry.registerStrategy(strategyId, await dca.getAddress(), nextOverrides())).wait();
  console.log('Registered strategy id (SimpleDCA):', strategyId);

  // Deploy SmartBtcDca implementation template (not proxy)
  const SmartBtcDca = await ethers.getContractFactory('SmartBtcDca');
  const smart = await SmartBtcDca.deploy(nextOverrides());
  await smart.waitForDeployment();
  console.log('SmartBtcDca (template):', await smart.getAddress());

  // Register SmartBtcDca strategy id
  const smartId = ethers.id('btc-dca-power-law-v1');
  await (await registry.registerStrategy(smartId, await smart.getAddress(), nextOverrides())).wait();
  console.log('Registered strategy id (SmartBtcDca):', smartId);

  // Deploy WalletFactory (UUPS)
  const WalletFactory = await ethers.getContractFactory('WalletFactory');
  const factory = await upgrades.deployProxy(WalletFactory, [deployer.address, registryAddr, cfg.uniswapV3Router], { kind: 'uups', txOverrides: nextOverrides() });
  await factory.waitForDeployment();
  console.log('WalletFactory (proxy):', await factory.getAddress());

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
