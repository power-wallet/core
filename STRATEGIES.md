## Power Wallet Strategies – Technical Overview and Comparison

This document describes the four on-chain strategies implemented in this repository and helps you decide which one fits your objectives. It covers intent/purpose, mechanics, buy/sell rules, cadence, configuration, and trade‑offs.

- `contracts/contracts/strategies/SimpleDCA.sol`
- `contracts/contracts/strategies/PowerBtcDcaV2.sol`
- `contracts/contracts/strategies/SmartBtcDcaV2.sol`
- `contracts/contracts/strategies/TrendBtcDcaV1.sol`

### Quick comparison

| Strategy | Core idea | Buys | Sells | Market model | Cadence | Best for |
| --- | --- | --- | --- | --- | --- | --- |
| Simple DCA | Fixed amount at fixed interval | Fixed stable amount each tick | Never | None | Fixed seconds `frequency` | Hands‑off, long horizon accumulation |
| Power BTC DCA | Power‑law fair‑value bands | Larger below lower band; small between lower and model | Above upper band | Price ~ C·d^N bands | Fixed seconds `frequency` | Mean‑reversion believers seeking band discipline |
| Smart BTC DCA | Target weight bands + vol/drawdown kicker | Weekly base DCA + kicker; optional band rebalancing | Threshold sells when overweight | NAV, target BTC weight band, indicators | Fixed seconds `frequency` | Adaptive buying with risk bands and buffers |
| Trend BTC DCA | Trend filter (SMA50 + hysteresis + slope) with DCA in downtrends | Full buy on uptrend; DCA % in downtrend (boosted when discounted) | Full sell on downtrend trigger | SMA(50), hysteresis, slope | Fixed seconds `frequency` | Momentum/trend followers with gentle DCA in bears |

---

## Choosing the right strategy

- Prefer stability and simplicity → Simple DCA.
- Believe in long‑term mean reversion to a power‑law fair value → Power BTC DCA.
- Want adaptive buys with risk awareness and band discipline → Smart BTC DCA.
- Want to be aligned with trend, but keep accumulating in drawdowns → Trend BTC DCA.

In practice, many users blend approaches: e.g., start with Smart BTC DCA (buffers + kicker), and rotate to Trend BTC DCA during high volatility regimes, or keep a baseline Simple DCA while running Power BTC DCA on a subset of funds for trims.

---

## SimpleDCA (`SimpleDCA.sol`)

### Intent & purpose
- Accumulate BTC over time with minimal logic and minimal parameters.
- Ignores price; simply buys a fixed stable amount on a fixed cadence.

### Core configuration
- `dcaAmountStable` (stable units): fixed amount to spend per evaluation.
- `frequency` (seconds): minimum time gap between evaluations (gating).

### Buy/Sell rules
- Buy: if `block.timestamp >= lastTimestamp + frequency` and `stableBalance >= dcaAmountStable`, buy exactly `dcaAmountStable` of risk asset.
- Sell: never sells.

### Cadence & mechanics
- Time‑gate via `frequency`; `onRebalanceExecuted` updates `lastTimestamp`.
- Requires an authorized wallet to call lifecycle hooks.

### Pros, cons, applicability
- Pros: extremely simple, predictable; minimizes timing risk via averaging.
- Cons: no responsiveness; keeps buying through prolonged drawdowns; never trims risk.
- Best for: long‑term believers who want pure accumulation with minimal tuning.

---

## Power BTC DCA (`PowerBtcDcaV2.sol`)

### Intent & purpose
- Use a long‑term power‑law fair‑value model to scale buys/sells by where price sits versus model bands.
- Encourage mean‑reversion buys below fair value and trims above.

### Model & configuration
- Model: P(t) = A · d^N (days since 2009‑01‑03), computed in fixed‑point on‑chain.
- Bands (bps around model):
  - `lowerBandBps`, `upperBandBps` define thresholds around the fair‑value model.
- Trade sizing (in basis points):
  - Buys: `buyBpsOfStable` (below lower band), `smallBuyBpsOfStable` (between lower band and model).
  - Sells: `sellBpsOfRisk` (above upper band).
- `frequency` (seconds): evaluation gate.

### Buy/Sell rules
- If price < lower band: buy `buyBpsOfStable` of stable balance.
- If lower ≤ price ≤ model: buy `smallBuyBpsOfStable` of stable balance.
- If price > upper band: sell `sellBpsOfRisk` of risk balance.
- All actions require passing the `frequency` gate and minimum value checks.

### Cadence & mechanics
- Evaluates on a fixed cadence; trades at most once per evaluation.
- Uses Chainlink BTC/USD; computes model in 64.64 fixed‑point.

### Pros, cons, applicability
- Pros: systematic trims near perceived overvaluation; scales buys when cheap.
- Cons: Model risk (power‑law may deviate); bands must be tuned to risk tolerance.
- Best for: users who want disciplined mean‑reversion anchored to a long‑term model.

---

## Smart BTC DCA (`SmartBtcDcaV2.sol`)

### Intent & purpose
- Adaptive DCA that respects a BTC weight band, optional threshold rebalancing, and a vol/drawdown‑scaled “kicker” to buy more when risk is elevated.

### Core configuration
- Cadence & base budget:
  - `baseDcaStable` (stable units per tick), `frequency` (seconds).
  - `bufferMultX`: keep a stable buffer of `bufferMultX × baseDcaStable` before spending above base.
- Weight band and threshold rebalancing:
  - Target `targetBtcBps` with `bandDeltaBps` around it; optional `thresholdMode` to SELL down to upper band or BUY up to lower band, capped by `rebalanceCapBps` (of NAV).
- Kicker (extra buy sizing):
  - Uses indicators (EWMA vol, drawdown) to compute `kickerUsd` scaled by `kKicker1e6`; capped by `cmaxMultX × baseDcaStable`.

### Buy/Sell rules
- Threshold mode (optional):
  - If BTC weight > upper band → SELL down toward band (capped by `rebalanceCapBps`).
  - If BTC weight < lower band → BUY up toward band (capped and bounded by available stable).
- Otherwise on evaluation:
  - Spend up to `baseDcaStable` plus `kicker` (bounded by buffer and stable available).

### Cadence & mechanics
- Evaluates on fixed cadence; reads Chainlink price and indicators.
- Computes NAV from current stable + risk to derive BTC weight.

### Pros, cons, applicability
- Pros: responsive to risk via vol/drawdown; optional band discipline; respects cash buffers.
- Cons: more parameters to tune; depends on indicator availability/quality.
- Best for: users wanting adaptive buys with guardrails and occasional rebalancing.

---

## Trend BTC DCA (`TrendBtcDcaV1.sol`)

### Intent & purpose
- Follow the trend (SMA50) with hysteresis and a slope gate; be all‑in BTC in confirmed uptrends, DCA gently in downtrends (boosted when price is far below SMA).

### Core configuration
- Trend filter:
  - `smaLength` (default 50), `hystBps` (e.g., 150 = 1.5%), `slopeLookbackDays`.
- DCA in downtrends:
  - `dcaPctBps` (e.g., 5%), `discountBelowSmaPct` (e.g., ≥15% below SMA → boost), `dcaBoostMultiplier` (e.g., 2×), `minCashStable`, `minSpendStable`.
- `frequency` (seconds): evaluation gate.

### Buy/Sell rules (state machine)
- Determine thresholds: `upThresh = SMA × (1 + hyst)`, `dnThresh = SMA × (1 − hyst)`; `slopeOk` if SMA rising vs lookback.
- If not in DCA mode and price > upThresh and slopeOk → BUY 100% stable into BTC.
- If not in DCA mode and (price < dnThresh or !slopeOk) → SELL 100% BTC to stable and enter DCA mode.
- If in DCA mode and not enterUp and stable > `minCashStable` → DCA `dcaPctBps` of stable; if discount ≥ `discountBelowSmaPct` → multiply spend by `dcaBoostMultiplier` (bounded by stable) and BUY.
- If in DCA mode and enterUp → BUY all stable (exit DCA mode).

### Cadence & mechanics
- Evaluates on fixed cadence; uses Chainlink price and a `TechnicalIndicators` contract for SMA and history.

### Pros, cons, applicability
- Pros: avoids fighting strong downtrends; buys more when price is materially below SMA.
- Cons: Whipsaw risk around the band; parameter choice affects sensitivity.
- Best for: users who prefer momentum/trend alignment with controlled DCA in bears.
