import { ethers } from 'hardhat';

/**
 * Deploy SimpleDCA implementation (non-proxy template).
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploy-simple-dca.ts --network base-sepolia
 * 
 * Verify: 
 *  npx hardhat verify --network base-sepolia 0x97ee87073A5a430006020A60fC8F6190Fc9Fe082
 * 
 * Optional: register in StrategyRegistry (owner only)
 *   REGISTER=1 REGISTRY=0x53B4C7F51904b888f61859971B11ff51a8e43F80 STRATEGY_ID=simple-btc-dca-v1 \
 *   npx hardhat run scripts/deploy/deploy-simple-dca.ts --network base-sepolia
 */

const STRATEGY_ID = 'simple-btc-dca-v1';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // Fee overrides to reduce collision in busy mempools
  const fee = await ethers.provider.getFeeData();
  const basePri = fee.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const baseMax = fee.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');
  const overrides = {
    maxPriorityFeePerGas: basePri,
    maxFeePerGas: baseMax,
  } as any;

  // Deploy SimpleDCA template
  const SimpleDCA = await ethers.getContractFactory('SimpleDCA');
  const dca = await SimpleDCA.deploy(overrides);
  await dca.waitForDeployment();
  const dcaAddr = await dca.getAddress();
  console.log('SimpleDCA (template):', dcaAddr);

  // Optional registration in StrategyRegistry
  if (process.env.REGISTER === '1') {
    const registryAddr = process.env.REGISTRY;
    if (!registryAddr) throw new Error('REGISTER=1 requires REGISTRY=0x...');
    const idStr = process.env.STRATEGY_ID || STRATEGY_ID;
    const id = idStr.startsWith('0x') && idStr.length === 66 ? idStr : ethers.id(idStr);
    const registry = await ethers.getContractAt('StrategyRegistry', registryAddr, deployer);
    const tx = await registry.registerStrategy(id, dcaAddr);
    console.log('registerStrategy tx:', tx.hash);
    await tx.wait();
    console.log('Registered strategy id:', id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


