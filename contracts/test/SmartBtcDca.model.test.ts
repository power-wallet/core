import { expect } from "chai";
import { ethers } from "hardhat";
import { SmartBtcDca__factory } from "../typechain-types";

// Helper to compute double-precision reference P = C * d^N (1e8 scaled)
function cpuReferencePrice1e8(d: number): bigint {
  const C = 9.65e-18;
  const N = 5.845;
  const p = C * Math.pow(d, N); // USD
  const scaled = p * 1e8; // 1e8 decimals
  return BigInt(Math.round(scaled));
}

describe("SmartBtcDca model helpers", () => {
  it("daysSinceGenesis matches known calendar date 2025-10-09 UTC", async () => {
    const [deployer] = await ethers.getSigners();
    const smart = await new SmartBtcDca__factory(deployer).deploy();
    // 2025-10-09T00:00:00Z
    const ts = 1759968000n;
    const d = await smart.daysSinceGenesis.staticCall(ts);
    expect(d).to.eq(6123n);
  });

  it("modelPriceUSD_1e8 matches A=9.64e-18, n=5.8451 within tolerance for 2025-10-09 (d=6123)", async () => {
    const [deployer] = await ethers.getSigners();
    const smart = await new SmartBtcDca__factory(deployer).deploy();

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
    const smart = await new SmartBtcDca__factory(deployer).deploy();

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


