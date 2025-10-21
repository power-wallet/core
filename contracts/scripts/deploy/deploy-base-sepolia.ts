// scripts/deploy/base-deploy.ts
import { ethers, upgrades, network } from 'hardhat';
import { addresses } from '../../config/addresses';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const chainKey = (process.env.CHAIN_KEY as string) || network.name;
  const cfg = addresses[chainKey];
  if (!cfg) throw new Error(`No config for ${chainKey}`);
  console.log('Network:', chainKey);

  // Use pending nonce to avoid collisions with other pending txs from the same account
  let next = await ethers.provider.getTransactionCount(deployer.address, 'pending');
  const nextNonce = () => ({ nonce: next++ });

  // Deploy StrategyRegistry (UUPS)
  const StrategyRegistry = await ethers.getContractFactory('StrategyRegistry');
  const registry = await upgrades.deployProxy(StrategyRegistry, [deployer.address], { kind: 'uups' });
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log('StrategyRegistry (proxy):', registryAddr);

  // Deploy SimpleDCA implementation template (not proxy)
  const SimpleDCA = await ethers.getContractFactory('SimpleDCA');
  const dca = await SimpleDCA.deploy(nextNonce());
  await dca.waitForDeployment();
  console.log('SimpleDCA (template):', await dca.getAddress());

  // Register strategy id (updated canonical id)
  const simpleId = ethers.id('simple-btc-dca-v1');
  await (await registry.registerStrategy(simpleId, await dca.getAddress(), nextNonce())).wait();
  console.log('Registered strategy id (SimpleDCA) simple-btc-dca-v1:', simpleId);

  // Deploy PowerBtcDcaV2 implementation template (not proxy)
  const PowerBtcDca = await ethers.getContractFactory('PowerBtcDcaV2');
  const power = await PowerBtcDca.deploy(nextNonce());
  await power.waitForDeployment();
  console.log('PowerBtcDcaV2 (template):', await power.getAddress());

  // Register PowerBtcDcaV2 strategy id
  const powerId = ethers.id('power-btc-dca-v2');
  await (await registry.registerStrategy(powerId, await power.getAddress(), nextNonce())).wait();
  console.log('Registered strategy id (PowerBtcDcaV2) power-btc-dca-v2:', powerId);

  // Deploy SmartBtcDcaV2 implementation template (not proxy)
  const SmartBtcDca = await ethers.getContractFactory('SmartBtcDcaV2');
  const smart = await SmartBtcDca.deploy(nextNonce());
  await smart.waitForDeployment();
  console.log('SmartBtcDcaV2 (template):', await smart.getAddress());

  // Register SmartBtcDcaV2 strategy id
  const smartId = ethers.id('smart-btc-dca-v2');
  await (await registry.registerStrategy(smartId, await smart.getAddress(), nextNonce())).wait();

  // Deploy TrendBtcDcaV1 implementation template (not proxy)
  const TrendBtcDcaV1 = await ethers.getContractFactory('TrendBtcDcaV1');
  const trend = await TrendBtcDcaV1.deploy(nextNonce());
  await trend.waitForDeployment();
  console.log('TrendBtcDcaV1 (template):', await trend.getAddress());

  // Register TrendBtcDcaV1 strategy id
  const trendId = ethers.id('trend-btc-dca-v1');
  await (await registry.registerStrategy(trendId, await trend.getAddress(), nextNonce())).wait();
  console.log('Registered strategy id (TrendBtcDcaV1) trend-btc-dca-v1:', trendId);
  console.log('Registered strategy id (SmartBtcDcaV2) smart-btc-dca-v2:', smartId);


  // Deploy WalletFactory (UUPS)
  const WalletFactory = await ethers.getContractFactory('WalletFactory');
  const factory = await upgrades.deployProxy(
    WalletFactory,
    [deployer.address, registryAddr, cfg.uniswapV3Router, cfg.uniswapV3Factory],
    { kind: 'uups' }
  );
  await factory.waitForDeployment();
  console.log('WalletFactory (proxy):', await factory.getAddress());

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
