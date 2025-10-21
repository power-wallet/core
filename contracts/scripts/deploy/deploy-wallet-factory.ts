import { ethers, upgrades, network } from 'hardhat';
import { addresses } from '../../config/addresses';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const chainKey = (process.env.CHAIN_KEY as string) || network.name;
  const cfg = addresses[chainKey];
  if (!cfg) throw new Error(`No config for ${chainKey}`);
  console.log('Network:', chainKey);

  const ownerAddr = process.env.OWNER_ADDR || deployer.address;
  const registryAddr = process.env.REGISTRY_ADDR || cfg.strategyRegistry;
  if (!registryAddr) {
    throw new Error('Missing StrategyRegistry address. Set REGISTRY_ADDR env or addresses[chain].strategyRegistry');
  }

  if (!cfg.uniswapV3Router || !cfg.uniswapV3Factory) {
    throw new Error('Missing Uniswap addresses in config');
  }

  console.log('Parameters:');
  console.log('  Owner:        ', ownerAddr);
  console.log('  Registry:     ', registryAddr);
  console.log('  UniV3 Router: ', cfg.uniswapV3Router);
  console.log('  UniV3 Factory:', cfg.uniswapV3Factory);

  const WalletFactory = await ethers.getContractFactory('WalletFactory');
  const factory = await upgrades.deployProxy(
    WalletFactory,
    [ownerAddr, registryAddr, cfg.uniswapV3Router, cfg.uniswapV3Factory],
    { kind: 'uups' }
  );
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log('WalletFactory (proxy):', factoryAddr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


