import { ethers, network } from "hardhat";
import { addresses as chainAddrs } from "../../config/addresses";

const FACTORY_ABI = [
  { type: "function", name: "getPool", stateMutability: "view", inputs: [ { name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "fee", type: "uint24" } ], outputs: [ { name: "pool", type: "address" } ] },
] as const;

const POOL_ABI = [
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [ { type: "uint128" } ] },
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [ { type: "address" } ] },
  { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [ { type: "address" } ] },
] as const;

const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [ { type: "uint8" } ] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [ { name: "a", type: "address" } ], outputs: [ { type: "uint256" } ] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [ { name: "owner", type: "address" }, { name: "spender", type: "address" } ], outputs: [ { type: "uint256" } ] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [ { name: "spender", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [ { type: "bool" } ] },
] as const;

const SWAP_ROUTER_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [ { name: "amountOut", type: "uint256" } ],
  },
] as const;

async function main() {
  const [signer] = await ethers.getSigners();
  const chainKey = ((): keyof typeof chainAddrs => {
    if (network.name === "base") return "base";
    return "base-sepolia";
  })();

  const cfg = chainAddrs[chainKey];
  if (!cfg.cbBTC || !cfg.walletFactory) {
    console.log(`Config missing for ${chainKey}`);
    return;
  }

  const USDC = cfg.usdc as `0x${string}`;
  const RISK = (cfg.cbBTC || cfg.wbtc || cfg.weth) as `0x${string}`;
  const FEE: number = 100;
  const ROUTER = cfg.uniswapV3Router as `0x${string}`;
  const FACTORY = cfg.uniswapV3Factory as `0x${string}`;

  console.log(`Network: ${network.name}`);
  console.log(`Signer: ${await signer.getAddress()}`);
  console.log(`Router: ${ROUTER}`);
  console.log(`USDC: ${USDC}`);
  console.log(`RISK: ${RISK}`);

  // Verify pool exists and has liquidity
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, ethers.provider);
  const poolAddr: string = await factory.getPool(USDC, RISK, FEE);
  console.log(`Pool (USDC/RISK, fee ${FEE}): ${poolAddr}`);
  if (poolAddr === ethers.ZeroAddress) {
    console.log("No pool found; aborting.");
    return;
  }
  const pool = new ethers.Contract(poolAddr, POOL_ABI, ethers.provider);
  const [liq, token0, token1] = await Promise.all([
    pool.liquidity() as Promise<bigint>,
    pool.token0() as Promise<string>,
    pool.token1() as Promise<string>,
  ]);
  console.log(`Pool liquidity: ${liq.toString()}`);
  console.log(`token0=${token0} token1=${token1}`);

  // Approve USDC to router (safe pattern)
  const usdc = new ethers.Contract(USDC, ERC20_ABI, signer);
  const dec: number = await usdc.decimals();
  const bal: bigint = await usdc.balanceOf(await signer.getAddress());
  const amountIn: bigint = ethers.parseUnits("1", dec); // 1 USDC
  console.log(`USDC balance: ${ethers.formatUnits(bal, dec)} (need ${ethers.formatUnits(amountIn, dec)})`);
  if (bal < amountIn) {
    console.log("Insufficient USDC balance. Fund this account and retry.");
    return;
  }

  const allowance: bigint = await usdc.allowance(await signer.getAddress(), ROUTER);
  if (allowance < amountIn) {
    if (allowance > 0n) {
      console.log("Resetting allowance to 0...");
      await (await usdc.approve(ROUTER, 0n)).wait();
    }
    console.log("Approving max allowance...");
    await (await usdc.approve(ROUTER, ethers.MaxUint256)).wait();
  }

  console.log("Waiting for 1 seconds before swapping...");

  // wait for 10 seconds
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Execute swap
  const router = new ethers.Contract(ROUTER, SWAP_ROUTER_ABI, signer);
  async function trySwap(amount: bigint) {
    console.log(`\nAttempting swap of ${ethers.formatUnits(amount, dec)} USDC -> cbBTC (amountOutMinimum=0)`);
    try {
      await router.exactInputSingle.staticCall({
        tokenIn: USDC,
        tokenOut: RISK,
        fee: FEE,
        recipient: await signer.getAddress(),
        amountIn: amount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }, { value: 0 });
      console.log("Static simulation passed; sending tx...");
    } catch (e: any) {
      console.error("Static simulation reverted:", e?.shortMessage || e?.reason || e?.message || e);
      const curAllowance = await usdc.allowance(await signer.getAddress(), ROUTER);
      console.log("Current allowance:", curAllowance.toString());
      return;
    }
    const tx = await router.exactInputSingle({
      tokenIn: USDC,
      tokenOut: RISK,
      fee: FEE,
      recipient: await signer.getAddress(),
      amountIn: amount,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    }, { value: 0 });
    console.log("Sent:", tx.hash);
    const rc = await tx.wait();
    console.log("Mined in block:", rc?.blockNumber);
  }

  // Try 1 USDC, then 0.01 USDC
  await trySwap(amountIn);
  const amountSmall = ethers.parseUnits("0.01", dec);
  await trySwap(amountSmall);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


