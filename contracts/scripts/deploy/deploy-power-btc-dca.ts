import { ethers } from "hardhat";

/**
 * Deploy PowerBtcDcaV2 implementation (non-proxy template).
 * Do NOT initialize here; WalletFactory will clone and initialize per wallet.
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploy-power-btc-dca.ts --network base-sepolia
 *
 * Optional: register in StrategyRegistry (owner only)
 *   REGISTER=1 REGISTRY=0x... STRATEGY_ID=power-btc-dca-v2 \
 *   npx hardhat run scripts/deploy/deploy-power-btc-dca.ts --network base-sepolia
 */

const STRATEGY_ID = 'power-btc-dca-v2';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // Fee overrides similar to SimpleDCA deploy
  const fee = await ethers.provider.getFeeData();
  const basePri = fee.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const baseMax = fee.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');
  let nonce = await deployer.getNonce("pending");
  const overrides = { maxPriorityFeePerGas: basePri, maxFeePerGas: baseMax, nonce } as any;

  const Strategy = await ethers.getContractFactory("PowerBtcDcaV2");
  const impl = await Strategy.deploy(overrides);
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log('PowerBtcDcaV2 (template):', implAddr);

  if (process.env.REGISTER === '1') {
    const registryAddr = process.env.REGISTRY;
    if (!registryAddr) throw new Error('REGISTER=1 requires REGISTRY=0x...');
    const idStr = process.env.STRATEGY_ID || STRATEGY_ID;
    const id = idStr.startsWith('0x') && idStr.length === 66 ? idStr : ethers.id(idStr);
    const registry = await ethers.getContractAt('StrategyRegistry', registryAddr, deployer);
    // refresh gas and nonce for registration
    const fee2 = await ethers.provider.getFeeData();
    let pri2 = fee2.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
    let max2 = fee2.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');
    // Use pending nonce to avoid replacement issues
    let regNonce = await deployer.getNonce("pending");
    const send = async () => {
      const tx = await registry.registerStrategy(id, implAddr, { maxPriorityFeePerGas: pri2, maxFeePerGas: max2, nonce: regNonce } as any);
      console.log('registerStrategy tx:', tx.hash);
      await tx.wait();
      console.log('Registered strategy id:', id);
    };
    try {
      await send();
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes('underpriced') || msg.includes('replacement') || msg.includes('already known') || msg.includes('nonce too low')) {
        // bump and retry
        regNonce = await deployer.getNonce("pending");
        pri2 = pri2 + ethers.parseUnits('0.5', 'gwei');
        max2 = max2 + ethers.parseUnits('1', 'gwei');
        const tx = await registry.registerStrategy(id, implAddr, { maxPriorityFeePerGas: pri2, maxFeePerGas: max2, nonce: regNonce } as any);
        console.log('registerStrategy retry tx:', tx.hash);
        await tx.wait();
        console.log('Registered strategy id (retry):', id);
      } else {
        throw e;
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


