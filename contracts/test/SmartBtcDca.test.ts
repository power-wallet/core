import { expect } from "chai";
import { ethers } from "hardhat";
import { MockV3Aggregator__factory, MockERC20__factory, SmartBtcDca__factory } from "../typechain-types";

describe("SmartBtcDca strategy", () => {
  async function deployFixture() {
    const [deployer] = await ethers.getSigners();

    const btcFeed = await new MockV3Aggregator__factory(deployer).deploy(8, 100_000_000n); // $1.00 initial

    // Deploy a minimal wallet that calls shouldRebalance; we reuse PowerWallet balances via token mocks
    const usdc = await new MockERC20__factory(deployer).deploy("USDC", "USDC", 6);
    const cbBTC = await new MockERC20__factory(deployer).deploy("cbBTC", "cbBTC", 8);

    // Mint some balances to the wallet (we simulate wallet address as deployer for shouldRebalance params)
    await usdc.mint(deployer.address, 1_000_000_000n); // 1,000 USDC
    await cbBTC.mint(deployer.address, 0n);

    const smart = await new SmartBtcDca__factory(deployer).deploy();
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
    // Model is internal; we simulate low price well below lower band
    await btcFeed.updateAnswer(10_000_000n); // $0.10

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
    await btcFeed.updateAnswer(1_000_000_000_000n); // very high price

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
    // Set price between lower band and model (exact model is opaque, we use a moderate price)
    await btcFeed.updateAnswer(50_000_000n); // $0.50

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
    // Choose a price above model but below upper band
    await btcFeed.updateAnswer(150_000_000n); // $1.50

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


