# Smart Contract Architecture


## Overview

This document describes the on-chain architecture for the PowerWallet protocol. The system centers around user-owned wallets that hold assets and periodically rebalance according to pluggable strategy contracts. Supporting components include a registry for strategy implementations, a factory to deploy user wallets and clone strategies, a technical indicators module for time-series analytics, and integrations with Chainlink (price feeds + automation) and Uniswap V3 for execution.

## Architecture Diagram (ASCII)

```
                                      (Admin)
                                        |
                          register/remove strategy impls
                                        v
                           +-------------------------+
                           |    StrategyRegistry     |  (UUPS)
                           |  id => implementation   |
                           +-----------+-------------+
                                       |
                        get impl by id |
                                       v
   (User) ----------------------> +-----+---------------------+
  createWallet(...)               |       WalletFactory       |  (UUPS)
                                  | - clones strategy impl    |
                                  | - deploys PowerWallet     |
                                  | - wires config            |
                                  +-----+---------------+-----+
                                        |               |
                           strategy clone|               | new wallet
                                        v               v
                             +----------+----+    +-----+------------------------------+
                             |   Strategy    |    |            PowerWallet              |
                             | (IStrategy)   |    | Ownable, Automation, Reentrancy     |
                             | SimpleDCA /   |    | - holds stable + risk assets        |
                             | SmartBtcDca   |    | - Chainlink feeds per risk asset    |
                             +----------+----+    | - UniswapV3 router + factory        |
                                        ^         | - strategy address                   |
                                        |         +-----+----------------------+---------+
                         shouldRebalance|               |                      |
                         onRebalance... |               | exactInputSingle     | price/oracle reads
                                        |               v                      v
                                  +-----+--------+  +---+----------------+  +--------------------+
                                  | Chainlink    |  | Uniswap V3 Router |  | Chainlink Price    |
                                  | Automation   |  | + Factory (checks)|  | Feeds (per asset)  |
                                  +--------------+  +--------------------+  +--------------------+

                                   (Optional analytics / backfills)
                                                     ^
                                                     |
                                  +------------------+------------------+
                                  |        TechnicalIndicators           |  (UUPS, Automation)
                                  | - daily closes, RSI/SMA, ETH/BTC RSI |
                                  | - keeper-gated updates/backfills     |
                                  +--------------------------------------+ 
```

## Components

- WalletFactory (UUPS):
  - Clones a strategy implementation from `StrategyRegistry` and initializes it while the factory is owner, then transfers strategy ownership to the user.
  - Deploys a new `PowerWallet`, initializes it with assets, feeds, fees, router/factory, and the freshly cloned strategy, then transfers wallet ownership to the user.
  - Tracks `user => wallets[]` and exposes basic getters.

- StrategyRegistry (UUPS):
  - On-chain map of `bytes32 id => address implementation` with events for register/remove.
  - Queried by the factory at wallet creation time.

- PowerWallet (Ownable, AutomationCompatible, ReentrancyGuard):
  - Holds assets: one stable asset (e.g., USDC) and N risk assets (e.g., cbBTC, WETH).
  - Maintains `priceFeeds[riskAsset]` for Chainlink price reads and `poolFees[riskAsset]` for Uniswap V3 pools.
  - Exposes deposits/withdrawals (stable and risk), portfolio valuation, and histories (deposits/withdrawals/swaps).
  - Chainlink Automation: `checkUpkeep()` calls `strategy.shouldRebalance(...)`; `performUpkeep()` re-computes actions, executes swaps via Uniswap V3 router, records swap deltas, and best-effort calls `strategy.onRebalanceExecuted()`.
  - Slippage protection: computes `amountOutMinimum` using Chainlink prices and a configurable `slippageBps`.
  - Pool validation: `setFees()` validates pools using Uniswap V3 factory.
  - Safety: supports pausing automation and permanently closing a wallet (sweeps funds to owner).

- Strategies (IStrategy):
  - Pure decision engines returning one or more `SwapAction`s when rebalancing is needed.
  - `SimpleDCA`: buys a fixed stable amount into one risk asset on a fixed cadence.
  - `SmartBtcDca`: banded power‑law BTC model; buys more below model, small buys near model, sells above upper band. Uses `ABDKMath64x64` for fixed‑point math and Chainlink BTC/USD feed.
  - Optional hook: `IStrategyExecutionHook.onRebalanceExecuted()` to update internal state (e.g., timestamps) post-trade.

- TechnicalIndicators (UUPS, AutomationCompatible):
  - Stores daily close prices per token, calculates SMA, RSI, Wilder's RSI, and ETH/BTC RSI.
  - Keeper-gated daily updates within a narrow UTC-after-midnight window; owner can backfill to fix gaps.
  - Intended for advanced/derived strategies and analytics; not required by `SimpleDCA` or `SmartBtcDca`.

- External Interfaces:
  - Chainlink Price Feeds for pricing and wallet slippage bounds.
  - Chainlink Automation for cron-like rebalancing and indicator updates.
  - Uniswap V3 Router + Factory for on-chain execution and pool existence validation.

## Core Flows

- Create Wallet (user):
  1) User calls `WalletFactory.createWallet(strategyId, initData, stable, risk[], feeds[], fees[])`.
  2) Factory resolves impl from `StrategyRegistry`, clones, initializes strategy (factory is temporary owner), then transfers strategy ownership to user.
  3) Factory deploys `PowerWallet`, initializes config (assets/feeds/fees/router/factory/strategy), then transfers wallet ownership to user and records it.

- Automation Rebalance (wallet):
  1) Keeper calls `checkUpkeep()`; wallet snapshots balances and calls `strategy.shouldRebalance(...)`.
  2) If needed, keeper calls `performUpkeep()`; wallet recomputes actions, validates assets/pools, computes `amountOutMinimum`, and executes swaps via Uniswap V3.
  3) Wallet records swap deltas and emits events; best-effort calls `strategy.onRebalanceExecuted()`.

- Technical Indicators Daily Update:
  1) Keeper checks for tokens needing yesterday's close; aborts if gaps detected.
  2) Within the first hour after midnight UTC, `performUpkeep()` appends yesterday's price from Chainlink and updates `lastUpdateTimestamp`.
  3) Owner can backfill contiguous gaps with strict timestamp checks.

## Design & Safety Notes

- Ownership model: the user owns both the strategy instance and the wallet post-creation; the factory/registry are upgradeable and owned by the protocol admin.
- Upgradeability: `WalletFactory`, `StrategyRegistry`, and `TechnicalIndicators` are UUPS; `PowerWallet` instances are simple contracts (not upgradeable per instance).
- Price/decimals: wallet uses Chainlink feeds (typically 8 decimals) and token metadata decimals; minOut is derived conservatively via `slippageBps` to mitigate sandwich/price movement.
- Router approvals: wallet uses a safe allowance pattern (clear-if-needed, then set max) prior to swaps to support strict ERC20s.
- Validation: wallet enforces that swap pairs include the configured `stableAsset` and a known `riskAsset`; `setFees()` validates pools against Uniswap V3 factory.

