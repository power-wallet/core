import { ethers } from "hardhat";

async function main() {
  const registryAddr = process.env.REGISTRY!; // StrategyRegistry
  const implAddr = process.env.STRATEGY!;     // PowerBtcDcaV1 implementation address
  const id = ethers.encodeBytes32String("power-btc-dca-v1");

  const registry = await ethers.getContractAt("StrategyRegistry", registryAddr);
  const tx = await registry.registerStrategy(id, implAddr);
  await tx.wait();
  console.log(`Registered power-btc-dca-v1 -> ${implAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });


