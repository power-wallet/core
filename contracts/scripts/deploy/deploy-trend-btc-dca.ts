import { ethers } from 'hardhat';

/**
 * Deploy TrendBtcDcaV1 implementation (non-proxy template) and optionally register in StrategyRegistry.
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploy-trend-btc-dca.ts --network base-sepolia
 *
 * Optional registration:
 *   REGISTER=1 REGISTRY=0xYourRegistry STRATEGY_ID=trend-btc-dca-v1 \
 *   npx hardhat run scripts/deploy/deploy-trend-btc-dca.ts --network base-sepolia
 */

const DEFAULT_STRATEGY_ID = 'trend-btc-dca-v1';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const fee = await ethers.provider.getFeeData();
  const basePri = fee.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const baseMax = fee.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');
  const overrides = {
    maxPriorityFeePerGas: basePri,
    maxFeePerGas: baseMax,
  } as any;

  // Deploy TrendBtcDcaV1 template
  const Trend = await ethers.getContractFactory('TrendBtcDcaV1');
  const trend = await Trend.deploy(overrides);
  await trend.waitForDeployment();
  const trendAddr = await trend.getAddress();
  console.log('TrendBtcDcaV1 (template):', trendAddr);

  if (process.env.REGISTER === '1') {
    const registryAddr = process.env.REGISTRY;
    if (!registryAddr) throw new Error('REGISTER=1 requires REGISTRY=0x...');
    const idStr = process.env.STRATEGY_ID || DEFAULT_STRATEGY_ID;
    const id = idStr.startsWith('0x') && idStr.length === 66 ? idStr : ethers.id(idStr);
    const registry = await ethers.getContractAt('StrategyRegistry', registryAddr, deployer);

    // Re-fetch fees for robustness; let provider manage nonce automatically
    const fee2 = await ethers.provider.getFeeData();
    let pri = fee2.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
    let max = fee2.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');

    const send = async () => {
      const tx = await registry.registerStrategy(
        id,
        trendAddr,
        { maxPriorityFeePerGas: pri, maxFeePerGas: max } as any,
      );
      console.log('registerStrategy tx:', tx.hash);
      await tx.wait();
      console.log('Registered strategy id:', id);
    };

    try {
      await send();
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes('underpriced') || msg.includes('replacement') || msg.includes('already known') || msg.includes('nonce too low')) {
        pri = pri + ethers.parseUnits('0.5', 'gwei');
        max = max + ethers.parseUnits('1', 'gwei');
        const tx2 = await registry.registerStrategy(
          id,
          trendAddr,
          { maxPriorityFeePerGas: pri, maxFeePerGas: max } as any,
        );
        console.log('registerStrategy retry tx:', tx2.hash);
        await tx2.wait();
        console.log('Registered strategy id (retry):', id);
      } else {
        throw e;
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


