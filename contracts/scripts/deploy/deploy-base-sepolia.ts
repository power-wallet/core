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
  const simpleId = ethers.id('simple-btc-dca-v1');
  await (await registry.registerStrategy(simpleId, await dca.getAddress(), nextOverrides())).wait();
  console.log('Registered strategy id (SimpleDCA) simple-btc-dca-v1:', simpleId);

  // Deploy PowerBtcDcaV2 implementation template (not proxy)
  const PowerBtcDca = await ethers.getContractFactory('PowerBtcDcaV2');
  const power = await PowerBtcDca.deploy(nextOverrides());
  await power.waitForDeployment();
  console.log('PowerBtcDcaV2 (template):', await power.getAddress());

  // Register PowerBtcDcaV2 strategy id
  const powerId = ethers.id('smart-btc-dca-v2');
  await (await registry.registerStrategy(powerId, await power.getAddress(), nextOverrides())).wait();
  console.log('Registered strategy id (PowerBtcDcaV2) smart-btc-dca-v2:', powerId);

  // Deploy SmartBtcDcaV2 implementation template (not proxy)
  const SmartBtcDca = await ethers.getContractFactory('SmartBtcDcaV2');
  const smart = await SmartBtcDca.deploy(nextOverrides());
  await smart.waitForDeployment();
  console.log('SmartBtcDcaV2 (template):', await smart.getAddress());

  // Register SmartBtcDcaV2 strategy id
  const smartId = ethers.id('smart-btc-dca-v2');
  await (await registry.registerStrategy(smartId, await smart.getAddress(), nextOverrides())).wait();
  console.log('Registered strategy id (SmartBtcDcaV2) smart-btc-dca-v2:', smartId);


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
