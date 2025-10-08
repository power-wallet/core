import { ethers } from 'hardhat';

/**
 * Deploy SmartBtcDca implementation (non-proxy template).
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploy-smart-dca.ts --network base-sepolia
 *
 * Verify: 
 *  npx hardhat verify --network base-sepolia 0xbf88275c8FAaE73C6c0be8291b9394fAc8aD9Df8
 * 
 * Optional: register in StrategyRegistry (owner only)
 *   REGISTER=1 REGISTRY=0x53B4C7F51904b888f61859971B11ff51a8e43F80 STRATEGY_ID=btc-dca-power-law-v1 \
 *   npx hardhat run scripts/deploy/deploy-smart-dca.ts --network base-sepolia
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // Basic fee bumping to reduce nonce/race issues if sending multiple txs
  const fee = await ethers.provider.getFeeData();
  const basePri = fee.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const baseMax = fee.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');
  const overrides = {
    maxPriorityFeePerGas: basePri,
    maxFeePerGas: baseMax,
  } as any;

  // Deploy SmartBtcDca template
  const SmartBtcDca = await ethers.getContractFactory('SmartBtcDca');
  const smart = await SmartBtcDca.deploy(overrides);
  await smart.waitForDeployment();
  const smartAddr = await smart.getAddress();
  console.log('SmartBtcDca (template):', smartAddr);

  // Optional registration in StrategyRegistry
  if (process.env.REGISTER === '1') {
    const registryAddr = process.env.REGISTRY;
    if (!registryAddr) throw new Error('REGISTER=1 requires REGISTRY=0x...');
    const idStr = process.env.STRATEGY_ID || 'btc-dca-power-law-v1';
    const id = idStr.startsWith('0x') && idStr.length === 66 ? idStr : ethers.id(idStr);
    const registry = await ethers.getContractAt('StrategyRegistry', registryAddr, deployer);
    const tx = await registry.registerStrategy(id, smartAddr);
    console.log('registerStrategy tx:', tx.hash);
    await tx.wait();
    console.log('Registered strategy id:', id);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


