import { ethers } from "hardhat";
import { addresses as chainAddresses } from "../config/addresses";

// Deployed PowerWallet on Base Sepolia (provided by user)
const POWER_WALLET_ADDRESS = "0x20F58A060E2d52D576D4B67E53feCff5a53AC614" as const;

// Minimal ABIs
const powerWalletAbi = [
  { type: "function", name: "checkUpkeep", stateMutability: "view", inputs: [{ name: "", type: "bytes" }], outputs: [ { name: "upkeepNeeded", type: "bool" }, { name: "performData", type: "bytes" } ] },
  { type: "function", name: "performUpkeep", stateMutability: "nonpayable", inputs: [{ name: "performData", type: "bytes" }], outputs: [] },
  { type: "function", name: "getBalances", stateMutability: "view", inputs: [], outputs: [ { name: "stableBal", type: "uint256" }, { name: "riskBals", type: "uint256[]" } ] },
  { type: "function", name: "getRiskAssets", stateMutability: "view", inputs: [], outputs: [ { name: "assets", type: "address[]" } ] },
  { type: "function", name: "stableAsset", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "address" } ] },
  { type: "function", name: "strategy", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "address" } ] },
  { type: "function", name: "getPortfolioValueUSD", stateMutability: "view", inputs: [], outputs: [ { name: "usd6", type: "uint256" } ] },
  { type: "function", name: "poolFees", stateMutability: "view", inputs: [{ name: "risk", type: "address" }], outputs: [{ name: "fee", type: "uint24" }] },
] as const;

const simpleDcaAbi = [
  { type: "function", name: "dcaAmountStable", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "uint256" } ] },
  { type: "function", name: "frequency", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "uint256" } ] },
] as const;

const uniswapV3FactoryAbi = [
  { type: "function", name: "getPool", stateMutability: "view", inputs: [ { name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "fee", type: "uint24" } ], outputs: [ { name: "pool", type: "address" } ] },
] as const;

const uniswapV3PoolAbi = [
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "uint128" } ] },
  { type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [
    { name: "sqrtPriceX96", type: "uint160" },
    { name: "tick", type: "int24" },
    { name: "observationIndex", type: "uint16" },
    { name: "observationCardinality", type: "uint16" },
    { name: "observationCardinalityNext", type: "uint16" },
    { name: "feeProtocol", type: "uint8" },
    { name: "unlocked", type: "bool" },
  ] },
] as const;

type SwapAction = { tokenIn: string; tokenOut: string; amountIn: bigint };

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (chainId=${network.chainId})`);
  if (network.chainId !== 84532n) {
    console.warn("Warning: expected Base Sepolia (84532). Use --network base-sepolia");
  }

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${await signer.getAddress()}`);

  const wallet = new ethers.Contract(POWER_WALLET_ADDRESS, powerWalletAbi, signer);

  const [stable, riskAssets, usd6] = await Promise.all([
    wallet.stableAsset() as Promise<string>,
    wallet.getRiskAssets() as Promise<string[]>,
    wallet.getPortfolioValueUSD() as Promise<bigint>,
  ]);
  console.log("Stable Asset:", stable);
  console.log("Risk Assets:", riskAssets);
  console.log("Portfolio Value (USD, 6 decimals):", usd6.toString());

  // Inspect strategy params
  const strategyAddr = await wallet.strategy();
  const strategy = new ethers.Contract(strategyAddr, simpleDcaAbi, ethers.provider);
  const [dcaAmount, frequency] = await Promise.all([
    strategy.dcaAmountStable() as Promise<bigint>,
    strategy.frequency() as Promise<bigint>,
  ]);
  console.log("Strategy:", strategyAddr, "DCA Amount (USDC6):", dcaAmount.toString(), "Frequency (s):", frequency.toString());

  // Check planned upkeep
  const check = await wallet.checkUpkeep("0x");
  const upkeepNeeded: boolean = check[0];
  const performData: string = check[1];
  console.log("checkUpkeep.upkeepNeeded:", upkeepNeeded);

  // Decode performData into SwapAction[]
  const coder = ethers.AbiCoder.defaultAbiCoder();
  let actions: SwapAction[] = [];
  try {
    const decoded = coder.decode([
      "tuple(address tokenIn, address tokenOut, uint256 amountIn)[]",
    ], performData) as any[];
    actions = (decoded?.[0] || []) as SwapAction[];
  } catch (e) {
    console.warn("Failed to decode performData:", e);
  }
  console.log("Planned actions:");
  for (const a of actions) {
    console.log(" - tokenIn:", a.tokenIn, "tokenOut:", a.tokenOut, "amountIn:", a.amountIn?.toString?.() ?? String((a as any).amountIn));
  }

  // Verify Uniswap V3 pool existence and liquidity
  const chainKey = "base-sepolia" as const;
  const factoryAddr = chainAddresses[chainKey].uniswapV3Factory as `0x${string}`;
  const factory = new ethers.Contract(factoryAddr, uniswapV3FactoryAbi, ethers.provider);
  if (actions.length > 0) {
    const fee = await wallet.poolFees(actions[0].tokenIn === stable ? actions[0].tokenOut : actions[0].tokenIn);
    const poolAddr: string = await factory.getPool(actions[0].tokenIn, actions[0].tokenOut, fee);
    console.log("UniswapV3 Pool:", poolAddr, "Fee:", fee.toString());
    if (poolAddr === ethers.ZeroAddress) {
      console.warn("No pool found for given pair+fee. This will cause the swap to revert.");
    } else {
      const pool = new ethers.Contract(poolAddr, uniswapV3PoolAbi, ethers.provider);
      const [liquidity, slot0] = await Promise.all([
        pool.liquidity() as Promise<bigint>,
        pool.slot0() as Promise<any>,
      ]);
      console.log("Pool liquidity:", liquidity.toString(), "tick:", slot0.tick);
      if (liquidity === 0n) {
        console.warn("Pool has zero liquidity. Swaps will revert.");
      }
    }
  }

  if (!upkeepNeeded) {
    console.log("Upkeep not needed right now. Exiting.");
    return;
  }

  // First try a static call to capture the exact revert reason (if any)
  try {
    await wallet.performUpkeep.staticCall(performData);
    console.log("performUpkeep static simulation succeeded; sending transaction...");
  } catch (err: any) {
    console.error("performUpkeep static simulation reverted:", err?.shortMessage || err?.message || err);
    console.error("This likely indicates swap failure (pool missing, zero liquidity, or token/fee mismatch). Aborting send.");
    return;
  }

  // If simulation passes, actually send the transaction
  try {
    const tx = await wallet.performUpkeep(performData);
    console.log("performUpkeep tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("performUpkeep mined in block:", receipt.blockNumber, "status:", receipt.status);
  } catch (err: any) {
    console.error("performUpkeep transaction failed:", err?.shortMessage || err?.message || err);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


