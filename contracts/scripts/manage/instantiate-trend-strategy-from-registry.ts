import { ethers } from "hardhat";

/**
 * Instantiate a new TrendBtcDcaV1 strategy instance using default parameters,
 * and transfer ownership to the specified USER address.
 *
 * This script mirrors instantiate-power-strategy-from-registry.ts, but for TrendBtcDcaV1.
 * It deploys a fresh instance (not a minimal proxy clone), initializes it, then transfers ownership.
 *
 * Network: Configure constants below for the target chain (defaults set for Base mainnet).
 */

// ======== Constants (Base mainnet defaults - review before running) ========
const USER_ADDRESS = "0x4F888d90c31c97efA63f0Db088578BB6F9D1970C";
const WALLET_ADDRESS = "0xaB33f21667090D70D01fAaBbE23bd100944C74B9";
const REGISTRY = "0xD643C9Df3B3606Af35054824E5788f6c1b8B58Dd"; // StrategyRegistry on Base
const STRATEGY_ID_STRING = "trend-btc-dca-v1";

// Protocol addresses (Base)
const RISK_CB_BTC = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf"; // cbBTC
const STABLE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC.e
const BTC_USD_FEED = "0x07DA0E54543a844a80ABE69c8A12F22B3aA59f9D"; // Chainlink BTC/USD
const TECHNICAL_INDICATORS = "0xE0087A5EcAaF884894946191eb9d5FD0841D95Ec";

// Trend parameters (match frontend defaults)
const FREQUENCY_SECONDS = BigInt(5 * 24 * 60 * 60); // 5 days
const SMA_LENGTH = 50;              // SMA50
const HYST_BPS = 150;               // 1.5% hysteresis band (bps)
const SLOPE_LOOKBACK_DAYS = 14;     // slope window
const DCA_PCT_BPS = 500;            // 5%
const DISCOUNT_BELOW_SMA_PCT = 15;  // 15%
const DCA_BOOST_MULTIPLIER = 2;     // 2x
const MIN_CASH_STABLE = 100n * 1_000_000n; // $100 in 6 decimals
const MIN_SPEND_STABLE = 1n * 1_000_000n;  // $1 in 6 decimals
const DESCRIPTION = "Trend BTC DCA (SMA50 with hysteresis & DCA-only in downtrend)";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Operator: ${signer.address}`);

  // Verify registry contains a non-zero implementation for this id
  const id = STRATEGY_ID_STRING.startsWith('0x') && STRATEGY_ID_STRING.length === 66
    ? STRATEGY_ID_STRING
    : ethers.id(STRATEGY_ID_STRING);
  const registry = await ethers.getContractAt("StrategyRegistry", REGISTRY, signer);
  const impl = await registry.strategies(id);
  if (impl === ethers.ZeroAddress) {
    throw new Error(`Strategy id not registered: ${STRATEGY_ID_STRING}`);
  }
  console.log("Registered implementation:", impl);

  // Deploy a fresh TrendBtcDcaV1 instance
  const Trend = await ethers.getContractFactory("TrendBtcDcaV1", signer);
  const instance = await Trend.deploy();
  await instance.waitForDeployment();
  const instanceAddr = await instance.getAddress();
  console.log("Deployed TrendBtcDcaV1 instance:", instanceAddr);

  // Gas fee overrides to reduce replacement-underpriced issues on sequential txs
  const fee = await ethers.provider.getFeeData();
  const basePri = fee.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const baseMax = fee.maxFeePerGas ?? ethers.parseUnits('10', 'gwei');
  const overrides1 = { maxPriorityFeePerGas: basePri, maxFeePerGas: baseMax } as any;

  // Initialize with constants
  const initTx = await instance.initialize(
    RISK_CB_BTC,
    STABLE_USDC,
    BTC_USD_FEED,
    TECHNICAL_INDICATORS,
    FREQUENCY_SECONDS,
    SMA_LENGTH,
    HYST_BPS,
    SLOPE_LOOKBACK_DAYS,
    DCA_PCT_BPS,
    DISCOUNT_BELOW_SMA_PCT,
    DCA_BOOST_MULTIPLIER,
    MIN_CASH_STABLE,
    MIN_SPEND_STABLE,
    DESCRIPTION,
    overrides1
  );
  console.log("initialize tx:", initTx.hash);
  await initTx.wait();

  // call setAuthorizedWallet with bumped fees to avoid replacement-underpriced
  {
    const fee2 = await ethers.provider.getFeeData();
    let pri = fee2.maxPriorityFeePerGas ?? basePri;
    let max = fee2.maxFeePerGas ?? baseMax;
    try {
      const saTx = await instance.setAuthorizedWallet(WALLET_ADDRESS, { maxPriorityFeePerGas: pri, maxFeePerGas: max } as any);
      console.log("setAuthorizedWallet tx:", saTx.hash);
      await saTx.wait();
    } catch (e: any) {
      const bump = (v: bigint) => v + (v / 10n) + 1n; // ~+10% + 1 wei
      pri = bump(pri);
      max = bump(max);
      const saTx2 = await instance.setAuthorizedWallet(WALLET_ADDRESS, { maxPriorityFeePerGas: pri, maxFeePerGas: max } as any);
      console.log("setAuthorizedWallet (retry) tx:", saTx2.hash);
      await saTx2.wait();
    }
  }
  
  // Transfer ownership to USER_ADDRESS (with bumped fees)
  const bump = (v: bigint) => v + (v / 10n) + 1n; // ~+10% + 1 wei
  const overrides2 = { maxPriorityFeePerGas: bump(basePri), maxFeePerGas: bump(baseMax) } as any;
  try {
    const ownTx = await instance.transferOwnership(USER_ADDRESS, overrides2);
    console.log("transferOwnership tx:", ownTx.hash);
    await ownTx.wait();
  } catch (e: any) {
    const overrides3 = { maxPriorityFeePerGas: bump(bump(basePri)), maxFeePerGas: bump(bump(baseMax)) } as any;
    const ownTx2 = await instance.transferOwnership(USER_ADDRESS, overrides3);
    console.log("transferOwnership (retry) tx:", ownTx2.hash);
    await ownTx2.wait();
  }

  console.log("Trend strategy instance ready for:", USER_ADDRESS);
  console.log("Call PowerWallet.setStrategy(", instanceAddr, ", 0x) from the owner wallet.");
}

main().catch((e) => { console.error(e); process.exit(1); });


