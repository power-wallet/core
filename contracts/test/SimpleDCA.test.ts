import { expect } from "chai";
import { ethers } from "hardhat";

describe("SimpleDCA strategy", () => {
  async function deployFixture() {
    const [deployer] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await ERC20.deploy("USDC", "USDC", 6);
    const cbBTC = await ERC20.deploy("cbBTC", "cbBTC", 8);

    const Simple = await ethers.getContractFactory("SimpleDCA");
    const dca = await Simple.deploy();

    const amountStable = 100_000_000n; // 100 USDC in 6d
    const frequency = 1n; // 1s
    await dca.initialize(await cbBTC.getAddress(), await usdc.getAddress(), amountStable, frequency, "Simple DCA");

    dca.setAuthorizedWallet(await deployer.getAddress());
    return { dca, usdc, cbBTC , deployer};
  }

  it("returns no action if stable asset mismatches", async () => {
    const { dca, cbBTC } = await deployFixture();
    const other = ethers.ZeroAddress;
    const [need, actions] = await dca.shouldRebalance.staticCall(
      other,
      [await cbBTC.getAddress()],
      1_000_000_000n,
      []
    );
    expect(need).to.eq(false);
    expect(actions.length).to.eq(0);
  });

  it("returns no action if risk asset mismatches", async () => {
    const { dca, usdc } = await deployFixture();
    const [need, actions] = await dca.shouldRebalance.staticCall(
      await usdc.getAddress(),
      [ethers.ZeroAddress],
      1_000_000_000n,
      []
    );
    expect(need).to.eq(false);
    expect(actions.length).to.eq(0);
  });

  it("returns no action if stable balance is insufficient", async () => {
    const { dca, usdc, cbBTC } = await deployFixture();
    const [need, actions] = await dca.shouldRebalance.staticCall(
      await usdc.getAddress(),
      [await cbBTC.getAddress()],
      50_000_000n, // 50 < 100
      []
    );
    expect(need).to.eq(false);
    expect(actions.length).to.eq(0);
  });

  it("suggests buy when balance sufficient and frequency passed", async () => {
    const { dca, usdc, cbBTC } = await deployFixture();
    const [need, actions] = await dca.shouldRebalance.staticCall(
      await usdc.getAddress(),
      [await cbBTC.getAddress()],
      200_000_000n, // 200 >= 100
      []
    );
    expect(need).to.eq(true);
    expect(actions.length).to.eq(1);
    expect(actions[0].tokenIn).to.eq(await usdc.getAddress());
    expect(actions[0].tokenOut).to.eq(await cbBTC.getAddress());
    expect(actions[0].amountIn).to.eq(100_000_000n);
  });

  it("updates lastTimestamp on onRebalanceExecuted", async () => {
    const { dca, usdc, cbBTC, deployer } = await deployFixture();
    const [need] = await dca.shouldRebalance.staticCall(
      await usdc.getAddress(),
      [await cbBTC.getAddress()],
      200_000_000n,
      []
    );
    expect(need).to.eq(true);
    // call and then ensure next call is frequency-gated
    await dca.onRebalanceExecuted([]);
    const [need2] = await dca.shouldRebalance.staticCall(
      await usdc.getAddress(),
      [await cbBTC.getAddress()],
      200_000_000n,
      []
    );
    // frequency=1s; without advancing time it's still gated, expect false
    expect(need2).to.eq(false);
  });
});


