import { expect } from "chai";
import { ethers } from "hardhat";
import { MockV3Aggregator__factory, MockERC20__factory, PowerBtcDcaV2__factory } from "../typechain-types";

// Helper to compute double-precision reference P = C * d^N (1e8 scaled)
function cpuReferencePrice1e8(d: number): bigint {
  const C = 9.65e-18;
  const N = 5.845;
  const p = C * Math.pow(d, N); // USD
  const scaled = p * 1e8; // 1e8 decimals
  return BigInt(Math.round(scaled));
}

describe("PowerBtcDcaV2 strategy", () => {
  async function deployFixture() {
    const [deployer] = await ethers.getSigners();

    const btcFeed = await new MockV3Aggregator__factory(deployer).deploy(8, 100_000_000n); // $1.00 initial

    // Deploy a minimal wallet that calls shouldRebalance; we reuse PowerWallet balances via token mocks
    const usdc = await new MockERC20__factory(deployer).deploy("USDC", "USDC", 6);
    const cbBTC = await new MockERC20__factory(deployer).deploy("cbBTC", "cbBTC", 8);

    // Mint some balances to the wallet (we simulate wallet address as deployer for shouldRebalance params)
    await usdc.mint(deployer.address, 1_000_000_000n); // 1,000 USDC
    await cbBTC.mint(deployer.address, 0n);

    const smart = await new PowerBtcDcaV2__factory(deployer).deploy();
    await smart.initialize(
      cbBTC.target as string,
      usdc.target as string,
      btcFeed.target as string,
      1,               // frequency: minimal non-zero to pass require and allow immediate
      5000,            // lowerBand 50%
      5000,            // upperBand 50%
      2000,            // buy 20% of stable (below lower band)
      1000,            // small buy 10% of stable (between lower band and model)
      2000,            // sell 20% of risk
      "Smart BTC DCA"
    );

    return { deployer, smart, btcFeed, usdc, cbBTC };
  }

  it("buys when price below lower band", async () => {
    const { smart, btcFeed, usdc, cbBTC } = await deployFixture();
    const res = await smart.getModelAndBands();
    const lower = res[1];
    const belowLower = lower > 0n ? lower - 1n : 0n;
    await btcFeed.updateAnswer(belowLower);

    const stableBal = 1_000_000_000n; // 1,000 USDC (6d)
    const riskBal = 0n;

    const [need, actions] = await smart.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [riskBal]
    );
    expect(need).to.eq(true);
    expect(actions.length).to.eq(1);
    expect(actions[0].tokenIn).to.eq(usdc.target);
    expect(actions[0].tokenOut).to.eq(cbBTC.target);
    // amount ≈ 20% of stable
    expect(actions[0].amountIn).to.eq(stableBal * 20n / 100n);
  });

  it("sells when price above upper band", async () => {
    const { smart, btcFeed, usdc, cbBTC } = await deployFixture();
    const res = await smart.getModelAndBands();
    const upper = res[2];
    await btcFeed.updateAnswer(upper + 1n);

    const stableBal = 0n;
    const riskBal = 1_000_000_000n; // 10 BTC (8d)

    const [need, actions] = await smart.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [riskBal]
    );
    expect(need).to.eq(true);
    expect(actions.length).to.eq(1);
    expect(actions[0].tokenIn).to.eq(cbBTC.target);
    expect(actions[0].tokenOut).to.eq(usdc.target);
    // amount ≈ 20% of risk
    expect(actions[0].amountIn).to.eq(riskBal * 20n / 100n);
  });

  it("buys small amount when price between lower band and model", async () => {
    const { smart, btcFeed, usdc, cbBTC } = await deployFixture();
    const res = await smart.getModelAndBands();
    const lower = res[1];
    const model = res[0];
    const between = lower + 1n < model ? lower + 1n : model; // ensure within (lower, model]
    await btcFeed.updateAnswer(between);

    const stableBal = 1_000_000_000n; // 1,000 USDC (6d)
    const riskBal = 0n;

    const [need, actions] = await smart.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [riskBal]
    );
    expect(need).to.eq(true);
    expect(actions.length).to.eq(1);
    expect(actions[0].tokenIn).to.eq(usdc.target);
    expect(actions[0].tokenOut).to.eq(cbBTC.target);
    // amount ≈ 10% of stable (small buy percentage)
    expect(actions[0].amountIn).to.eq(stableBal * 10n / 100n);
  });

  it("does nothing when price is above model but below upper band", async () => {
    const { smart, btcFeed, usdc, cbBTC } = await deployFixture();
    const res = await smart.getModelAndBands();
    const model = res[0];
    const upper = res[2];
    const between = model + 1n < upper ? model + 1n : (upper - 1n);
    await btcFeed.updateAnswer(between);

    const stableBal = 500_000_000n;
    const riskBal = 500_000_000n;

    const [need, actions] = await smart.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [riskBal]
    );
    expect(need).to.eq(false);
    expect(actions.length).to.eq(0);
  });
});

describe("PowerBtcDcaV2 model helpers", () => {

  it("daysSinceGenesis matches known calendar date 2025-10-09 UTC", async () => {
    const [deployer] = await ethers.getSigners();
    const smart = await new PowerBtcDcaV2__factory(deployer).deploy();
    // 2025-10-09T00:00:00Z
    const ts = 1759968000n;
    const d = await smart.daysSinceGenesis.staticCall(ts);
    expect(d).to.eq(6123n);
  });

  it("modelPriceUSD_1e8 matches A=9.64e-18, n=5.8451 within tolerance for 2025-10-09 (d=6123)", async () => {
    const [deployer] = await ethers.getSigners();
    const smart = await new PowerBtcDcaV2__factory(deployer).deploy();

    const d = 6123n;
    // Inspect internal logarithms
    const log2d = await (smart as any).debugLog2d.staticCall(d);
    const log2price = await (smart as any).debugLog2Price.staticCall(d);
    // Quick sanity: log2d should be ~12.58 in 64.64
    expect(Number(log2d) / Math.pow(2, 64)).to.be.greaterThan(10);
    expect(Number(log2price) / Math.pow(2, 64)).to.be.greaterThan(0);
    const model = await smart.modelPriceUSD_1e8.staticCall(d);

    // Ensure not hitting fallback (which is exactly 10000000000000)
    expect(model).to.not.eq(10_000_000_000_000n);

    // Compare with double-precision CPU reference with reasonable tolerance
    // params matching https://charts.bitbo.io/long-term-power-law/
    const A = 9.64e-18;
    const n = 5.8451;
    const ref = BigInt(Math.round(A * Math.pow(Number(d), n) * 1e8));

    // Allow a tolerance of 25% because on-chain uses fixed-point with approximations
    const tolBps = 2500n; // 25%
    const min = (ref * (10_000n - tolBps)) / 10_000n;
    const max = (ref * (10_000n + tolBps)) / 10_000n;

    expect(model).to.be.gte(min);
    expect(model).to.be.lte(max);
  });

  it("modelPriceUSD_1e8 matches model for a few other dates (A=9.64e-18, n=5.8451)", async () => {
    const [deployer] = await ethers.getSigners();
    const smart = await new PowerBtcDcaV2__factory(deployer).deploy();

    const dates = [
      // YYYY-MM-DD UTC → expected d
      { d: 365n, label: "2010-01-03" },
      { d: 1461n, label: "2013-01-03" },
      { d: 3653n, label: "2019-01-03" },
      { d: 6123n, label: "2025-10-09" },
    ];
    const A = 9.64e-18;
    const n = 5.8451;
    const tolBps = 1n; // 0.01% tolerance across wide range

    for (const { d, label } of dates) {
      const model = await smart.modelPriceUSD_1e8.staticCall(d);
      const ref = BigInt(Math.round(A * Math.pow(Number(d), n) * 1e8));
      const min = (ref * (10_000n - tolBps)) / 10_000n;
      const max = (ref * (10_000n + tolBps)) / 10_000n;
      expect(model, label + " model too low").to.be.gte(min);
      expect(model, label + " model too high").to.be.lte(max);
    }
  });
});
