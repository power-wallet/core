import { ethers } from "hardhat";

/**
 * Re-register a strategy implementation for a given id, and optionally
 * deploy+initialize a per-user SmartBtcDca instance and transfer ownership.
 *
 * Usage (re-register only):
 *   REGISTRY=0x... STRATEGY_ID=btc-dca-power-law-v1 NEW_IMPL=0x...
 *   npx hardhat run scripts/manage/update-strategy-impl.ts --network <net>
 *
 * Usage (also deploy per-user instance):
 *   REGISTRY=0x... STRATEGY_ID=btc-dca-power-law-v1 NEW_IMPL=0x...
 *   USER=0x... RISK=0x... STABLE=0x... FEED=0x...
 *   FREQ=86400 LOWER=5000 UPPER=5000 BUY=2000 SMALLBUY=1000 SELL=2000 DESC="Smart BTC DCA (Power Law)"
 *   npx hardhat run scripts/manage/update-strategy-impl.ts --network <net>
 */
async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Operator: ${signer.address}`);

  const registryAddr = process.env.REGISTRY;
  const newImpl = process.env.NEW_IMPL; // new SmartBtcDca template
  const idStr = process.env.STRATEGY_ID || "btc-dca-power-law-v1";
  if (!registryAddr || !newImpl) throw new Error("REGISTRY and NEW_IMPL are required");

  const id = idStr.startsWith('0x') && idStr.length === 66 ? idStr : ethers.id(idStr);
  const registry = await ethers.getContractAt("StrategyRegistry", registryAddr, signer);

  // If an old impl is present, remove it first
  const oldImpl = await registry.strategies(id);
  if (oldImpl !== ethers.ZeroAddress) {
    console.log("Removing existing strategy id:", id, "impl:", oldImpl);
    const tx1 = await registry.removeStrategy(id);
    console.log("removeStrategy tx:", tx1.hash);
    await tx1.wait();
  }

  console.log("Registering new implementation:", newImpl);
  const tx2 = await registry.registerStrategy(id, newImpl);
  console.log("registerStrategy tx:", tx2.hash);
  await tx2.wait();
  console.log("Registered strategy id:", id);
}

main().catch((e) => { console.error(e); process.exit(1); });
