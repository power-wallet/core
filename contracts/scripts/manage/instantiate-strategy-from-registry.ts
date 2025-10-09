import { ethers } from "hardhat";

/**
 * Clone the SmartBtcDca implementation from the StrategyRegistry for a given id,
 * initialize it with provided params, and transfer ownership to USER_ADDRESS.
 *
 * Usage:
 *   REGISTRY=0x... STRATEGY_ID=btc-dca-power-law-v1 USER_ADDRESS=0x...
 *   RISK=0x... STABLE=0x... FEED=0x...
 *   FREQ=604800 LOWER=5000 UPPER=10000 BUY=500 SMALLBUY=100 SELL=500 DESC="Smart BTC DCA (Power Law)"
 *   npx hardhat run scripts/manage/instantiate-strategy-from-registry.ts --network <net>
 * 
 * Example:
 *  USER_ADDRESS=<USER_ADDRESS> \
 *  REGISTRY=0x53B4C7F51904b888f61859971B11ff51a8e43F80 \
 *  STRATEGY_ID=btc-dca-power-law-v1 \
 *  RISK=0xcbB7C0006F23900c38EB856149F799620fcb8A4a \
 *  STABLE=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
 *  FEED=0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298 \
 *  FREQ=604800 LOWER=5000 UPPER=10000 BUY=500 SMALLBUY=100 SELL=500 
 *  DESC="Smart BTC DCA (Power Law)" \
 *  npx hardhat run scripts/manage/instantiate-strategy-from-registry.ts --network base-sepolia
 */
async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Operator: ${signer.address}`);

  const registryAddr = process.env.REGISTRY;
  const idStr = process.env.STRATEGY_ID || "btc-dca-power-law-v1";
  const user = process.env.USER_ADDRESS;
  const risk = process.env.RISK;
  const stable = process.env.STABLE;
  const feed = process.env.FEED;
  const freq = BigInt(process.env.FREQ || "604800"); // default 7 days
  const lower = Number(process.env.LOWER || "5000"); // 50% below model price
  const upper = Number(process.env.UPPER || "10000"); // 100% above model price
  const buy = Number(process.env.BUY || "500"); // 5% of stable balance
  const smallBuy = Number(process.env.SMALLBUY || "100"); // 1% of stable balance
  const sell = Number(process.env.SELL || "500"); // 5% of risk balance
  const desc = process.env.DESC || "Smart BTC DCA (Power Law)";

  if (!registryAddr) throw new Error("REGISTRY required");
  if (!user) throw new Error("USER_ADDRESS required");
  if (!risk || !stable || !feed) throw new Error("RISK, STABLE, FEED required");

  const id = idStr.startsWith('0x') && idStr.length === 66 ? idStr : ethers.id(idStr);
  const registry = await ethers.getContractAt("StrategyRegistry", registryAddr, signer);

  // Load implementation address
  const impl = await registry.strategies(id);
  if (impl === ethers.ZeroAddress) throw new Error("strategy id not registered");
  console.log("Implementation:", impl);

  // Deploy a fresh instance (not a minimal proxy clone; consistent with existing flow)
  const SmartBtcDca = await ethers.getContractFactory("SmartBtcDca", signer);
  const instance = await SmartBtcDca.deploy();
  await instance.waitForDeployment();
  const instanceAddr = await instance.getAddress();
  console.log("Deployed SmartBtcDca instance:", instanceAddr);

  // Fee overrides to avoid replacement-underpriced issues on back-to-back txs
  const fee = await ethers.provider.getFeeData();
  const basePri = fee.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const baseMax = fee.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');
  const overrides1 = { maxPriorityFeePerGas: basePri, maxFeePerGas: baseMax } as any;

  // Initialize with provided params
  const initTx = await instance.initialize(
    risk,
    stable,
    feed,
    freq,
    lower,
    upper,
    buy,
    smallBuy,
    sell,
    desc,
    overrides1
  );
  console.log("initialize tx:", initTx.hash);
  await initTx.wait();

  // Transfer ownership to USER_ADDRESS
  // Bump fees slightly for the subsequent tx
  const bump = (v: bigint) => v + (v / 10n) + 1n; // ~+10% + 1 wei
  const overrides2 = { maxPriorityFeePerGas: bump(basePri), maxFeePerGas: bump(baseMax) } as any;
  try {
    const ownTx = await instance.transferOwnership(user, overrides2);
    console.log("transferOwnership tx:", ownTx.hash);
    await ownTx.wait();
  } catch (e: any) {
    // Retry once with a larger bump if provider complains about underpriced replacement
    const overrides3 = { maxPriorityFeePerGas: bump(bump(basePri)), maxFeePerGas: bump(bump(baseMax)) } as any;
    const ownTx2 = await instance.transferOwnership(user, overrides3);
    console.log("transferOwnership (retry) tx:", ownTx2.hash);
    await ownTx2.wait();
  }

  console.log("Per-user strategy instance ready for:", user);
  console.log("Call PowerWallet.setStrategy(", instanceAddr, ", 0x) from the user's wallet owner account.");
}

main().catch((e) => { console.error(e); process.exit(1); });


