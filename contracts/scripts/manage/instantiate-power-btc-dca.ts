import { ethers, network } from "hardhat";
import { addresses } from "../../config/addresses";

/**
 * Instantiate a PowerBtcDcaV1 instance with default params and transfer ownership to USER.
 *
 * Usage:
 *   USER=0x... CHAIN=base-sepolia DESC="Power BTC DCA (Adaptive)" \
 *   npx hardhat run scripts/manage/instantiate-power-btc-dca.ts --network base-sepolia
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const chainKey = (process.env.CHAIN || network.name) as keyof typeof addresses;
  const cfg = (addresses as any)[chainKey];
  if (!cfg) throw new Error(`No addresses for chain ${chainKey}`);

  const USER = process.env.USER || process.env.USER_ADDRESS;
  const DESC = process.env.DESC || "Power BTC DCA (Adaptive)";

  // Defaults
  const risk = cfg.cbBTC || cfg.wbtc || cfg.weth;
  const stable = cfg.usdc;
  const feed = cfg.btcUsdPriceFeed;
  const indicators = cfg.technicalIndicators || ethers.ZeroAddress;
  const baseDcaStable = 100n * 1_000_000n;       // 100 USDC (6 decimals)
  const frequency = 7n * 24n * 60n * 60n;        // weekly
  const targetBps = 8000;                        // 80%
  const bandDeltaBps = 1000;                     // ±10%
  const bufferMultX = 9;                         // 9x
  const cmaxMultX = 3;                           // 3x base DCA
  const rebalanceCapBps = 500;                   // 5% NAV
  const kKicker1e6 = 50_000;                     // 0.05
  const thresholdMode = true;

  console.log(`Operator: ${deployer.address}`);
  console.log(`Chain: ${chainKey}`);
  console.log(`User: ${USER}`);

  // Gas fee baseline
  const fee = await ethers.provider.getFeeData();
  const basePri = fee.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const baseMax = fee.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');
  const overrides = { maxPriorityFeePerGas: basePri, maxFeePerGas: baseMax } as any;

  // Deploy and initialize
  const Strategy = await ethers.getContractFactory("PowerBtcDcaV1", deployer);
  const instance = await Strategy.deploy(overrides);
  await instance.waitForDeployment();
  const addr = await instance.getAddress();
  console.log("Deployed PowerBtcDcaV1 instance:", addr);

  const initTx = await instance.initialize(
    risk,
    stable,
    feed,
    indicators,
    baseDcaStable,
    frequency,
    targetBps,
    bandDeltaBps,
    bufferMultX,
    cmaxMultX,
    rebalanceCapBps,
    kKicker1e6,
    thresholdMode,
    DESC,
    overrides
  );
  console.log("initialize tx:", initTx.hash);
  await initTx.wait();

  // Transfer ownership
  const bump = (v: bigint) => v + (v / 10n) + 1n; // ~10% bump
  const ownTx = await instance.transferOwnership(
    USER as `0x${string}`,
    { maxPriorityFeePerGas: bump(basePri), maxFeePerGas: bump(baseMax) } as any
  );
  console.log("transferOwnership tx:", ownTx.hash);
  await ownTx.wait();

  console.log("PowerBtcDcaV1 ready and owned by:", USER);
}

main().catch((e) => { console.error(e); process.exit(1); });
