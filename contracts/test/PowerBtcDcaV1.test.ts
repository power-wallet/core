import { expect } from "chai";
import { ethers } from "hardhat";

describe("PowerBtcDcaV1", function () {
  it("initializes and produces DCA action on evaluation day", async () => {
    const [] = await ethers.getSigners();

    // Deploy mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USDC", "USDC", 6);
    const cbBTC = await MockERC20.deploy("cbBTC", "cbBTC", 8);

    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const btcFeed = await MockV3Aggregator.deploy(8, 100_000_000n); // $1.00

    const MockIndicators = await ethers.getContractFactory("MockIndicators");
    const indicators = await MockIndicators.deploy();
    await indicators.set(await cbBTC.getAddress(), 500_000_000n, 100_000_000n, 0n); // vol=5.0, dd=1.0 (exaggerated)

    const Strategy = await ethers.getContractFactory("PowerBtcDcaV1");
    const strat = await Strategy.deploy();

    const desc = "Power BTC DCA V1";
    await strat.initialize(
      await cbBTC.getAddress(),
      await usdc.getAddress(),
      await btcFeed.getAddress(),
      await indicators.getAddress(),
      100_000000n,             // baseDcaStable (100 USDC, 6 decimals)
      7n * 24n * 3600n,        // weekly
      7000,                    // target 70%
      2000,                    // ±20%
      9,                       // buffer 9×
      3,                       // kicker cap 3× base
      500,                     // 5% rebalance cap
      50_000,                  // kKicker=0.05 (1e6 scale)
      true,                    // threshold mode on
      desc
    );

    // Balances: 10,000 USDC, 0 BTC
    // shouldRebalance wants encoded balances; simulate wallet calling
    const stableBal = 10_000n * 1_000_000n; // USDC 6 decimals
    const riskBal = 0n; // cbBTC 8 decimals
    const needs = await strat.shouldRebalance(
      await usdc.getAddress(),
      [await cbBTC.getAddress()],
      stableBal,
      [riskBal]
    );
    const needsRebalance = needs[0];
    const actions = needs[1];
    expect(needsRebalance).to.eq(true);
    expect(actions.length).to.eq(1);
    expect(actions[0].tokenIn).to.eq(await usdc.getAddress());
    expect(actions[0].tokenOut).to.eq(await cbBTC.getAddress());
    expect(actions[0].amountIn).to.be.gt(0n);
  });

  it("threshold SELL to band respects rebalance cap", async () => {
    const [deployer] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USDC", "USDC", 6);
    const cbBTC = await MockERC20.deploy("cbBTC", "cbBTC", 8);
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const btcFeed = await MockV3Aggregator.deploy(8, 100_000_000n); // $1
    const MockIndicators = await ethers.getContractFactory("MockIndicators");
    const indicators = await MockIndicators.deploy();
    await indicators.set(await cbBTC.getAddress(), 0n, 0n, 0n);

    const Strategy = await ethers.getContractFactory("PowerBtcDcaV1");
    const strat = await Strategy.deploy();
    await strat.initialize(
      await cbBTC.getAddress(), await usdc.getAddress(), await btcFeed.getAddress(), await indicators.getAddress(),
      100_000000n, 7n*24n*3600n, 7000, 2000, 9, 3, 500, 50_000, true, "desc"
    );

    // NAV entirely in BTC (100% weight), should SELL down to 80% (upper band) capped at 5% NAV
    const stableBal = 0n;
    const riskBal = 10_000_00000000n; // 1e10 units (~$100m nominal at $1? but scale irrelevant for ratios)
    const [needs, actions] = await strat.shouldRebalance(
      await usdc.getAddress(), [await cbBTC.getAddress()], stableBal, [riskBal]
    );
    expect(needs).to.eq(true);
    expect(actions.length).to.eq(1);
    // Cap of 5% NAV at $1 implies 5% of risk units
    const capAmount = riskBal * 500n / 10000n;
    expect(actions[0].tokenIn).to.eq(await cbBTC.getAddress());
    expect(actions[0].amountIn).to.eq(capAmount);
  });

  it("threshold BUY to band respects cap and stable balance", async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USDC", "USDC", 6);
    const cbBTC = await MockERC20.deploy("cbBTC", "cbBTC", 8);
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const btcFeed = await MockV3Aggregator.deploy(8, 100_000_000n);
    const MockIndicators = await ethers.getContractFactory("MockIndicators");
    const indicators = await MockIndicators.deploy();
    await indicators.set(await cbBTC.getAddress(), 0n, 0n, 0n);

    const Strategy = await ethers.getContractFactory("PowerBtcDcaV1");
    const strat = await Strategy.deploy();
    await strat.initialize(
      await cbBTC.getAddress(), await usdc.getAddress(), await btcFeed.getAddress(), await indicators.getAddress(),
      100_000000n, 7n*24n*3600n, 7000, 2000, 9, 3, 500, 50_000, true, "desc"
    );

    // 0% BTC, 100% USDC, lower band = 50%, BUY to 60% (lower band), but cap is 5% of NAV and bounded by stable
    const stableBal = 10_000_000000n; // 10,000 USDC (6d)
    const riskBal = 0n;
    const [needs, actions] = await strat.shouldRebalance(
      await usdc.getAddress(), [await cbBTC.getAddress()], stableBal, [riskBal]
    );
    expect(needs).to.eq(true);
    expect(actions.length).to.eq(1);
    // expected USD cap = 5% NAV; convert to stable amount
    const nav1e8 = (stableBal * 100_000_000n) / 1_000_000n;
    const capUsd1e8 = (nav1e8 * 500n) / 10000n;
    const capStable = (capUsd1e8 * 1_000_000n) / 100_000_000n;
    expect(actions[0].tokenIn).to.eq(await usdc.getAddress());
    expect(actions[0].amountIn).to.eq(capStable);
  });

  it("kicker is capped by cmaxMultX over base", async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USDC", "USDC", 6);
    const cbBTC = await MockERC20.deploy("cbBTC", "cbBTC", 8);
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const btcFeed = await MockV3Aggregator.deploy(8, 100_000_000n);
    const MockIndicators = await ethers.getContractFactory("MockIndicators");
    const indicators = await MockIndicators.deploy();
    // very large vol and dd to force cap
    await indicators.set(await cbBTC.getAddress(), 10_000_000_000n, 100_000_000n, 0n); // vol=100, dd=1

    const Strategy = await ethers.getContractFactory("PowerBtcDcaV1");
    const strat = await Strategy.deploy();
    await strat.initialize(
      await cbBTC.getAddress(), await usdc.getAddress(), await btcFeed.getAddress(), await indicators.getAddress(),
      100_000000n, 7n*24n*3600n, 7000, 2000, 9, 3, 500, 50_000, false, "desc"
    );

    const stableBal = 100_000_000000n; // plenty of USDC
    const riskBal = 0n;
    const [, actions] = await strat.shouldRebalance(
      await usdc.getAddress(), [await cbBTC.getAddress()], stableBal, [riskBal]
    );
    // total = base (100 USDC) + capped kicker (3*base = 300 USDC)
    const expected = 400_000000n; // in stable units (6 decimals)
    expect(actions[0].amountIn).to.eq(expected);
  });

  it("kicker adds to base when vol and dd > 0 (not capped)", async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USDC", "USDC", 6);
    const cbBTC = await MockERC20.deploy("cbBTC", "cbBTC", 8);
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const btcFeed = await MockV3Aggregator.deploy(8, 100_000_000n);
    const MockIndicators = await ethers.getContractFactory("MockIndicators");
    const indicators = await MockIndicators.deploy();
    // vol=0.20, dd=0.30 → kicker = k * vol * dd * NAV = 0.05*0.2*0.3 = 0.003 NAV → $30 on $10k
    await indicators.set(await cbBTC.getAddress(), 20_000_000n, 30_000_000n, 0n);

    const Strategy = await ethers.getContractFactory("PowerBtcDcaV1");
    const strat = await Strategy.deploy();
    await strat.initialize(
      await cbBTC.getAddress(), await usdc.getAddress(), await btcFeed.getAddress(), await indicators.getAddress(),
      100_000000n, 7n*24n*3600n, 7000, 2000, 9, 3, 500, 50_000, false, "desc"
    );

    const stableBal = 10_000n * 1_000_000n; // 10,000 USDC
    const riskBal = 0n;
    const [, actions] = await strat.shouldRebalance(
      await usdc.getAddress(), [await cbBTC.getAddress()], stableBal, [riskBal]
    );
    // Expected = base 100 + kicker 30 = 130 USDC → 130_000000
    expect(actions[0].amountIn).to.eq(130_000000n);
  });

  it("threshold SELL brings BTC to upper band when uncapped", async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USDC", "USDC", 6);
    const cbBTC = await MockERC20.deploy("cbBTC", "cbBTC", 8);
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const btcFeed = await MockV3Aggregator.deploy(8, 100_000_000n);
    const MockIndicators = await ethers.getContractFactory("MockIndicators");
    const indicators = await MockIndicators.deploy();
    await indicators.set(await cbBTC.getAddress(), 0n, 0n, 0n);

    const Strategy = await ethers.getContractFactory("PowerBtcDcaV1");
    const strat = await Strategy.deploy();
    // rebalanceCapBps = 10000 to avoid cap
    await strat.initialize(
      await cbBTC.getAddress(), await usdc.getAddress(), await btcFeed.getAddress(), await indicators.getAddress(),
      100_000000n, 7n*24n*3600n, 7000, 2000, 9, 3, 10000, 50_000, true, "desc"
    );

    // risk $9,500, stable $500 → nav $10,000, upper=90% → target risk $9,000 → sell $500 risk
    const stableBal = 500n * 1_000_000n; // 500 USDC
    const riskBal = 9_500n * 100_000_000n; // 9,500 cbBTC units (8d) at $1
    const [, actions] = await strat.shouldRebalance(
      await usdc.getAddress(), [await cbBTC.getAddress()], stableBal, [riskBal]
    );
    expect(actions[0].tokenIn).to.eq(await cbBTC.getAddress());
    expect(actions[0].amountIn).to.eq(500n * 100_000_000n);
  });

  it("threshold BUY brings BTC to lower band when uncapped", async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USDC", "USDC", 6);
    const cbBTC = await MockERC20.deploy("cbBTC", "cbBTC", 8);
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const btcFeed = await MockV3Aggregator.deploy(8, 100_000_000n);
    const MockIndicators = await ethers.getContractFactory("MockIndicators");
    const indicators = await MockIndicators.deploy();
    await indicators.set(await cbBTC.getAddress(), 0n, 0n, 0n);

    const Strategy = await ethers.getContractFactory("PowerBtcDcaV1");
    const strat = await Strategy.deploy();
    await strat.initialize(
      await cbBTC.getAddress(), await usdc.getAddress(), await btcFeed.getAddress(), await indicators.getAddress(),
      100_000000n, 7n*24n*3600n, 7000, 2000, 9, 3, 10000, 50_000, true, "desc"
    );

    // risk $500, stable $9,500 → lower=50% → target risk $5,000 → buy $4,500 stable
    const stableBal = 9_500n * 1_000_000n; // 9,500 USDC
    const riskBal = 500n * 100_000_000n;
    const [, actions] = await strat.shouldRebalance(
      await usdc.getAddress(), [await cbBTC.getAddress()], stableBal, [riskBal]
    );
    expect(actions[0].tokenIn).to.eq(await usdc.getAddress());
    expect(actions[0].amountIn).to.eq(4_500n * 1_000_000n);
  });

  it("cadence gate blocks subsequent action until interval elapses", async () => {
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USDC", "USDC", 6);
    const cbBTC = await MockERC20.deploy("cbBTC", "cbBTC", 8);
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const btcFeed = await MockV3Aggregator.deploy(8, 100_000_000n);
    const MockIndicators = await ethers.getContractFactory("MockIndicators");
    const indicators = await MockIndicators.deploy();
    await indicators.set(await cbBTC.getAddress(), 0n, 0n, 0n);

    const Strategy = await ethers.getContractFactory("PowerBtcDcaV1");
    const strat = await Strategy.deploy();
    await strat.initialize(
      await cbBTC.getAddress(), await usdc.getAddress(), await btcFeed.getAddress(), await indicators.getAddress(),
      100_000000n, 7n*24n*3600n, 7000, 2000, 9, 3, 500, 50_000, false, "desc"
    );

    const stableBal = 10_000_000000n; // 10,000 USDC
    const riskBal = 0n;
    // First call should pass
    const first = await strat.shouldRebalance(await usdc.getAddress(), [await cbBTC.getAddress()], stableBal, [riskBal]);
    expect(first[0]).to.eq(true);
    // Mark executed
    await (await strat.onRebalanceExecuted()).wait();
    // Immediate second call should be blocked by frequency
    const second = await strat.shouldRebalance(await usdc.getAddress(), [await cbBTC.getAddress()], stableBal, [riskBal]);
    expect(second[0]).to.eq(false);
  });
});


