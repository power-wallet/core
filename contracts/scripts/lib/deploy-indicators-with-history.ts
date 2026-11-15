import { ethers, upgrades } from "hardhat";

/**
 * Deploys TechnicalIndicators (UUPS proxy) with a price history too large for a
 * single transaction.
 *
 * EIP-7825 (Osaka/Fusaka) caps a transaction at 16,777,216 gas. Storing a daily
 * price costs ~45k gas, so 200 days for two tokens in `initialize` (~18.8M gas)
 * no longer fits. Instead, `initialize` receives the first few days of each
 * token's history (at most MAX_INIT_PRICES prices in total across all tokens)
 * and the rest is appended with `backfillDailyPrices`, one token at a time, in
 * chunks of BACKFILL_CHUNK_DAYS. The resulting price history is identical.
 *
 * Differences from a single `initialize` call: `backfillDailyPrices` sets
 * `lastUpdateTimestamp` to the day after the last backfilled price (initialize
 * leaves it at 0) and emits `PriceAdded` for the backfilled days.
 *
 * The deploy takes several transactions. The proxy address and every completed
 * chunk are logged as they happen, so a run that fails partway can be finished
 * with `scripts/backfill-prices.ts` instead of redeploying.
 */

/** Total prices stored by `initialize`, summed over all tokens (~9M gas). */
export const MAX_INIT_PRICES = 200;
/** Prices per `backfillDailyPrices` transaction (~4.8M gas). */
export const BACKFILL_CHUNK_DAYS = 100;

const DAY = 24 * 60 * 60;

export async function deployIndicatorsWithHistory(
  tokens: string[],
  priceFeeds: string[],
  histories: bigint[][],
  startTimestamps: number[],
  deployOptions: Record<string, unknown> = {},
  log: (msg: string) => void = () => {}
) {
  if (tokens.length === 0 || tokens.length > MAX_INIT_PRICES) {
    throw new Error(`Unsupported token count: ${tokens.length}`);
  }
  // Split the initialize budget across tokens so the total stays under the cap
  // regardless of how many tokens are deployed.
  const initDays = Math.floor(MAX_INIT_PRICES / tokens.length);

  const TechnicalIndicators = await ethers.getContractFactory("TechnicalIndicators");

  const initialHistories = histories.map((h) => h.slice(0, initDays));
  const proxy = await upgrades.deployProxy(
    TechnicalIndicators,
    [tokens, priceFeeds, initialHistories, startTimestamps],
    { kind: "uups", initializer: "initialize", ...deployOptions }
  );
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  log(`TechnicalIndicators proxy deployed at ${proxyAddress} with ${initDays} days per token`);

  for (let t = 0; t < tokens.length; t++) {
    const history = histories[t];
    for (let i = initDays; i < history.length; i += BACKFILL_CHUNK_DAYS) {
      const prices = history.slice(i, i + BACKFILL_CHUNK_DAYS);
      const timestamps = prices.map((_, k) => BigInt(startTimestamps[t] + (i + k) * DAY));
      const tx = await (proxy as any).backfillDailyPrices(tokens[t], timestamps, prices);
      await tx.wait();
      const ymd = (ts: bigint) => new Date(Number(ts) * 1000).toISOString().slice(0, 10);
      log(
        `Backfilled ${tokens[t]} ${ymd(timestamps[0])}..${ymd(timestamps[timestamps.length - 1])} ` +
          `(days ${i}-${i + prices.length - 1} of ${history.length}, tx ${tx.hash})`
      );
    }
  }

  return proxy;
}
