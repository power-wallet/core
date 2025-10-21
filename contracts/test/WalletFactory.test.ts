import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("WalletFactory whitelist", () => {
  async function deployFixture() {
    const [owner, userA, userB] = await ethers.getSigners();

    // Deploy StrategyRegistry (UUPS)
    const StrategyRegistry = await ethers.getContractFactory("StrategyRegistry");
    const registry = await upgrades.deployProxy(StrategyRegistry, [owner.address], { kind: "uups" });

    // Deploy a strategy implementation (SimpleDCA)
    const SimpleDCA = await ethers.getContractFactory("SimpleDCA");
    const simpleImpl = await SimpleDCA.deploy();
    const stratId = ethers.encodeBytes32String("simple-btc-dca-v1");
    await registry.registerStrategy(stratId, await simpleImpl.getAddress());

    // Deploy WalletFactory (UUPS)
    const WalletFactory = await ethers.getContractFactory("WalletFactory");
    const swapRouter = owner.address;          // placeholder non-zero
    const uniswapV3Factory = owner.address;    // placeholder non-zero
    const factory = await upgrades.deployProxy(
      WalletFactory,
      [owner.address, await registry.getAddress(), swapRouter, uniswapV3Factory],
      { kind: "uups" }
    );

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const stable = await MockERC20.deploy("USDC", "USDC", 6);
    const risk = await MockERC20.deploy("cbBTC", "cbBTC", 8);

    // Build SimpleDCA init data: initialize(address risk, address stable, uint256 amountStable, uint256 freq, string desc)
    const iface = new ethers.Interface([
      "function initialize(address,address,uint256,uint256,string)"
    ]);
    const strategyInitData = iface.encodeFunctionData("initialize", [
      await risk.getAddress(),
      await stable.getAddress(),
      100_000_000n, // $100 (6 decimals)
      60n,          // 60s cadence
      "Simple BTC DCA"
    ]);

    const common = {
      stratId,
      strategyInitData,
      stable: await stable.getAddress(),
      risk: await risk.getAddress(),
      feed: owner.address,
      fee: 3000
    };

    async function createWalletAs(signer: any) {
      const f = factory.connect(signer);
      const tx = await f.createWallet(
        common.stratId,
        common.strategyInitData,
        common.stable,
        [common.risk],
        [common.feed],
        [common.fee]
      );
      const receipt = await tx.wait();
      return receipt;
    }

    return { owner, userA, userB, factory, registry, risk, stable, createWalletAs };
  }

  it("default disabled whitelist allows anyone to create", async () => {
    const { userA, factory, createWalletAs } = await deployFixture();

    await expect(createWalletAs(userA)).to.not.be.reverted;

    const wallets = await factory.getUserWallets(await userA.getAddress());
    expect(wallets.length).to.eq(1);
  });

  it("enabling whitelist blocks non-whitelisted callers", async () => {
    const { owner, userA, factory } = await deployFixture();

    await expect(factory.connect(owner).setWhitelistEnabled(true)).to.emit(factory, "WhitelistEnabled").withArgs(true);

    // userA is not whitelisted yet
    await expect(
      factory.connect(userA).createWallet(ethers.encodeBytes32String("simple-btc-dca-v1"), "0x", owner.address, [], [], [])
    ).to.be.revertedWith("not whitelisted");
  });

  it("owner can add/remove one address; view returns members", async () => {
    const { owner, userA, factory, createWalletAs } = await deployFixture();

    await factory.connect(owner).setWhitelistEnabled(true);

    // Add userA
    await expect(factory.connect(owner).addToWhitelist(await userA.getAddress()))
      .to.emit(factory, "WhitelistAdded").withArgs(await userA.getAddress());

    // Now userA can create
    await expect(createWalletAs(userA)).to.not.be.reverted;

    // getWhitelist should include userA
    const wl1 = await factory.getWhitelist();
    expect(wl1).to.include(await userA.getAddress());

    // Remove userA
    await expect(factory.connect(owner).removeFromWhitelist(await userA.getAddress()))
      .to.emit(factory, "WhitelistRemoved").withArgs(await userA.getAddress());

    // Creation should fail again
    await expect(createWalletAs(userA)).to.be.revertedWith("not whitelisted");

    // getWhitelist should not include userA
    const wl2 = await factory.getWhitelist();
    expect(wl2).to.not.include(await userA.getAddress());
  });
});


