import { ethers, upgrades } from "hardhat";

/**
 * Deploys TechnicalIndicators (UUPS proxy) with a price history too large for a
 * single transaction.
 *
 * EIP-7825 (Osaka/Fusaka) caps a transaction at 16,777,216 gas. Storing a daily
 * price costs ~45k gas, so 200 days for two tokens in `initialize` (~18.8M gas)
 * no longer fits. Instead, `initialize` receives the first INIT_CHUNK_DAYS of
 * each token's history and the rest is appended with `backfillDailyPrices` in
 * chunks of BACKFILL_CHUNK_DAYS. The resulting price history is identical.
 */
export const INIT_CHUNK_DAYS = 100;
export const BACKFILL_CHUNK_DAYS = 100;

const DAY = 24 * 60 * 60;

export async function deployIndicatorsWithHistory(
  tokens: string[],
  priceFeeds: string[],
  histories: bigint[][],
  startTimestamps: number[],
  deployOptions: Record<string, unknown> = {}
) {
  const TechnicalIndicators = await ethers.getContractFactory("TechnicalIndicators");

  const initialHistories = histories.map((h) => h.slice(0, INIT_CHUNK_DAYS));
  const proxy = await upgrades.deployProxy(
    TechnicalIndicators,
    [tokens, priceFeeds, initialHistories, startTimestamps],
    { kind: "uups", initializer: "initialize", ...deployOptions }
  );
  await proxy.waitForDeployment();

  for (let t = 0; t < tokens.length; t++) {
    const history = histories[t];
    for (let i = INIT_CHUNK_DAYS; i < history.length; i += BACKFILL_CHUNK_DAYS) {
      const prices = history.slice(i, i + BACKFILL_CHUNK_DAYS);
      const timestamps = prices.map((_, k) => BigInt(startTimestamps[t] + (i + k) * DAY));
      const tx = await (proxy as any).backfillDailyPrices(tokens[t], timestamps, prices);
      await tx.wait();
    }
  }

  return proxy;
}
