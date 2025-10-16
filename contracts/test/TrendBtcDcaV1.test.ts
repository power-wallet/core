import { expect } from "chai";
import { ethers } from "hardhat";
import { MockV3Aggregator__factory, MockERC20__factory, TrendBtcDcaV1__factory } from "../typechain-types";

async function setupIndicators(btc: string, deployer: any) {
  const MockSMA = await ethers.getContractFactory("MockSMA", deployer);
  const mock = await MockSMA.deploy();
  const start = Math.floor(Date.UTC(2025, 0, 1) / 1000); // 2025-01-01T00:00:00Z
  const days = 80;
  const prices: bigint[] = [];
  const tss: bigint[] = [];
  for (let i = 0; i < days; i++) {
    // 1e8-scaled BTC/USD prices: start ~$100,000 and trend up by ~$100/day
    const p = 100_000_00000000n + BigInt(i) * 100_00000000n; // $100,000 + i*$100, scaled 1e8
    prices.push(p);
    tss.push(BigInt(start + i * 86400));
  }
  await (mock as any).setSeries(btc, tss as any, prices as any);
  return mock;
}

describe("TrendBtcDcaV1", () => {
  async function deployFixture() {
    const [deployer] = await ethers.getSigners();
    const btcFeed = await new MockV3Aggregator__factory(deployer).deploy(8, 100_000_00000000n);
    const usdc = await new MockERC20__factory(deployer).deploy("USDC", "USDC", 6);
    const cbBTC = await new MockERC20__factory(deployer).deploy("cbBTC", "cbBTC", 8);

    const indicators = await setupIndicators(cbBTC.target as string, deployer);

    const strat = await new TrendBtcDcaV1__factory(deployer).deploy();
    await strat.initialize(
      cbBTC.target as string,
      usdc.target as string,
      btcFeed.target as string,
      indicators.target as string,
      1,           // frequency seconds (min for tests)
      50,          // smaLen
      150,         // hystBps 1.5%
      14,          // slope lookback days
      500,         // dcaPctBps 5%
      15,          // discountBelowSmaPct 15%
      2,           // dcaBoostMultiplier
      100_000_000n,// minCashStable $100 in 6d
      1_000_000n,  // minSpendStable $1 in 6d
      "Trend BTC DCA"
    );

    strat.setAuthorizedWallet(await deployer.getAddress());

    return { deployer, btcFeed, usdc, cbBTC, indicators, strat };
  }

  it("buys all stable when trend is up and not in DCA mode", async () => {
    const { strat, btcFeed, usdc, cbBTC, indicators } = await deployFixture();
    // simulate price clearly above up threshold: set high price
    await btcFeed.updateAnswer(110_000_00000000n);
    
    // Assert SMA50 < current price (uptrend confirmation)
    const sma50 = await (indicators as any).calculateSMA(cbBTC.target as string, 50);
    console.log(">> sma50", sma50);
    expect(sma50).to.be.lt(110_000_00000000n);
    
    const stableBal = 1_000_000_000n; // 1,000 USDC
    const [need, actions] = await strat.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [0n]
    );
    expect(need).to.eq(true);
    expect(actions.length).to.eq(1);
    expect(actions[0].tokenIn).to.eq(usdc.target);
    expect(actions[0].amountIn).to.eq(stableBal);
  });

  it("sells all BTC when trend exits up and not in DCA mode", async () => {
    const { strat, btcFeed, usdc, cbBTC } = await deployFixture();
    // explicitly start not in DCA mode to allow SELL branch
    await strat.setInDcaMode(false);
    // push price down well below dn threshold
    await btcFeed.updateAnswer(80_000_00000000n);
    const riskBal = 1_000_000_000n;
    const [need, actions] = await strat.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      0n,
      [riskBal]
    );
    expect(need).to.eq(true);
    expect(actions[0].tokenIn).to.eq(cbBTC.target);
    expect(actions[0].amountIn).to.eq(riskBal);
  });

  it("DCAs 5% when in DCA mode and not discounted", async () => {
    const { strat, btcFeed, usdc, cbBTC } = await deployFixture();
    // Manually set DCA mode
    await strat.setInDcaMode(true);
    // price modestly below SMA but not hitting 15% discount; keep same feed price
    await btcFeed.updateAnswer(98_000_00000000n);
    const stableBal = 1_000_000_000n; // 1,000 USDC
    const [need, actions] = await strat.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [0n]
    );
    expect(need).to.eq(true);
    // ~5% of stable = 50
    expect(actions[0].amountIn).to.eq(stableBal * 5n / 100n);
  });

  it("boosts DCA by multiplier when discounted >= threshold", async () => {
    const { strat, btcFeed, usdc, cbBTC } = await deployFixture();
    await strat.setInDcaMode(true);
    // Force heavy discount vs SMA by setting a low price
    await btcFeed.updateAnswer(80_000_00000000n);
    const stableBal = 1_000_000_000n;
    const [need, actions] = await strat.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [0n]
    );
    expect(need).to.eq(true);
    // spend ≈ min(stable, base*multiplier) = min(1000, 50*2=100) = 100
    expect(actions[0].amountIn).to.eq(100_000_000n);
  });

  it("switches from DCA to full BTC when trend resumes up", async () => {
    const { strat, btcFeed, usdc, cbBTC } = await deployFixture();
    await strat.setInDcaMode(true);
    await btcFeed.updateAnswer(120_000_00000000n); // strong up
    const stableBal = 1_000_000_000n;
    const [need, actions] = await strat.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [0n]
    );
    expect(need).to.eq(true);
    expect(actions[0].tokenIn).to.eq(usdc.target);
    expect(actions[0].amountIn).to.eq(stableBal);
  });

  it("enters DCA mode after exit signal (sell all) then DCAs on next eval", async () => {
    const { strat, btcFeed, usdc, cbBTC } = await deployFixture();
    // start not in DCA mode to observe SELL -> DCA transition
    await strat.setInDcaMode(false);
    expect(await strat.inDcaMode()).to.eq(false);

    // Step 1: trend exit → expect SELL all risk
    await btcFeed.updateAnswer(80_000_00000000n);
    const riskBal = 1_000_000_000n; // some BTC held
    let [need, actions] = await strat.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      0n,
      [riskBal]
    );
    expect(need).to.eq(true);
    expect(actions.length).to.eq(1);
    expect(actions[0].tokenIn).to.eq(cbBTC.target);
    expect(actions[0].amountIn).to.eq(riskBal);

    // Emulate wallet performing SELL; remains in DCA mode
    await strat.onRebalanceExecuted([
      { tokenIn: await cbBTC.getAddress(), tokenOut: await usdc.getAddress(), amountIn: riskBal }
    ]);
    expect(await strat.inDcaMode()).to.eq(true);

    // Step 2: still below uptrend, should DCA at base 5% (not discounted enough)
    await btcFeed.updateAnswer(98_000_00000000n);
    const stableBal = 1_000_000_000n; // 1,000 USDC
    ;([need, actions] = await strat.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [0n]
    ));
    expect(need).to.eq(true);
    // 5% of 1,000 = 50
    expect(actions[0].tokenIn).to.eq(usdc.target);
    expect(actions[0].amountIn).to.eq(50_000_000n);
  });

  it("on start below trend with stable-only, should DCA base 5%", async () => {
    const { strat, btcFeed, usdc, cbBTC } = await deployFixture();
    // Start is in DCA mode by default; set price modestly below SMA (< 15% discount)
    await btcFeed.updateAnswer(98_000_00000000n);
    const stableBal = 1_000_000_000n; // 1,000 USDC
    const [need, actions] = await strat.shouldRebalance.staticCall(
      usdc.target,
      [cbBTC.target],
      stableBal,
      [0n]
    );
    expect(need).to.eq(true);
    expect(actions.length).to.eq(1);
    expect(actions[0].tokenIn).to.eq(usdc.target);
    // 5% of 1,000 = 50
    expect(actions[0].amountIn).to.eq(50_000_000n);
  });
});


