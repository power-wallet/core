import { ethers } from "hardhat";
import { addresses as chainAddresses } from "../config/addresses";

// Base Sepolia config
const chainKey = "base-sepolia" as const;
const { uniswapV3Factory, usdc, cbBTC } = chainAddresses[chainKey];
const FEE = 100; // 0.01%

const factoryAbi = [
  { type: "function", name: "getPool", stateMutability: "view", inputs: [ { name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "fee", type: "uint24" } ], outputs: [ { name: "pool", type: "address" } ] },
] as const;

const poolAbi = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "address" } ] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "address" } ] },
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

const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [ { name: "account", type: "address" } ], outputs: [ { name: "", type: "uint256" } ] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "uint8" } ] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "string" } ] },
] as const;

function formatAmount(amount: bigint, decimals: number) {
  const denom = 10n ** BigInt(decimals);
  const whole = amount / denom;
  const frac = amount % denom;
  const fracStr = (frac + denom).toString().slice(1).replace(/0+$/, "");
  return fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (chainId=${network.chainId})`);

  const factory = new ethers.Contract(uniswapV3Factory, factoryAbi, ethers.provider);
  if (!cbBTC) {
    console.error("cbBTC address not configured for base-sepolia in contracts/config/addresses.ts");
    process.exit(1);
  }
  const poolAddr: string = await factory.getPool(usdc, cbBTC, FEE);
  console.log("Factory:", uniswapV3Factory);
  console.log("USDC:", usdc, "cbBTC:", cbBTC, "fee:", FEE);
  console.log("Pool:", poolAddr);
  if (poolAddr === ethers.ZeroAddress) {
    console.log("No pool found for given pair+fee.");
    return;
  }

  const pool = new ethers.Contract(poolAddr, poolAbi, ethers.provider);
  const [token0, token1, liquidity, slot0] = await Promise.all([
    pool.token0(),
    pool.token1(),
    pool.liquidity(),
    pool.slot0(),
  ]);

  console.log("token0:", token0);
  console.log("token1:", token1);
  console.log("liquidity:", liquidity.toString());
  console.log("tick:", slot0.tick, "sqrtPriceX96:", slot0.sqrtPriceX96.toString());

  const usdcC = new ethers.Contract(usdc, erc20Abi, ethers.provider);
  const cbBTCC = new ethers.Contract(cbBTC, erc20Abi, ethers.provider);
  const [usdcDec, usdcSym, cbDec, cbSym] = await Promise.all([
    usdcC.decimals() as Promise<number>,
    usdcC.symbol() as Promise<string>,
    cbBTCC.decimals() as Promise<number>,
    cbBTCC.symbol() as Promise<string>,
  ]);
  const [usdcBal, cbBal] = await Promise.all([
    usdcC.balanceOf(poolAddr) as Promise<bigint>,
    cbBTCC.balanceOf(poolAddr) as Promise<bigint>,
  ]);
  console.log(`${usdcSym} balance:`, formatAmount(usdcBal, usdcDec));
  console.log(`${cbSym} balance:`, formatAmount(cbBal, cbDec));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


