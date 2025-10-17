## Weekly Project Report

This report summarizes project progress week‑by‑week based on commit history, logs, and journal entries.

### Week of 2025‑09‑29 → 2025‑10‑05
- Project kickoff, tests, and core analytics
  - First commits; RSI (Wilder) calculation and tests; SMA tests; automation tests; price updates and data gap guard.
  - Frontend scaffolding and scripts; gas test; contracts view function for full price history.
- Strategy simulator and analytics UI (10‑01)
  - Strategy simulator, price chart, RSI & signal chart; chart annotations/visibility toggles; Sharpe/Sortino ratios; Portfolio Summary improvements.
  - Multi‑strategy refactor and about/info sections; component separation and persistence of controls.
- Portfolio/Wallet app surfaces (10‑03 → 10‑05)
  - Initial Portfolio and Wallet pages; deposit/withdraw flows; smart contracts page; deploy scripts; copy and formatting improvements.
  - Live price feeds; slippage protection; PowerWallet deploy scripts; config wiring; pool config; upkeep checks; mobile layout fixes.
  - Wallet history chart; deposits/withdrawals and swaps tables; closed wallets; loading indicators; layout updates.
  - Strategy config surface; “open config” button; close wallet flow; navbar/footer and copy tweaks; disclaimers.
  - Simple DCA strategy introduced.

### Week of 2025‑10‑06 → 2025‑10‑12
- Onboarding, infra, and portfolio polish (10‑06 → 10‑08)
  - Coinbase Smart Wallet onboarding improvements; centralized chain switching; app tools client; icons and build fixes.
  - Pool management page with add‑liquidity; copy/layout iterations; users page; Portfolio Summary tweaks; architecture diagram.
  - Strategy mapping to charts in simulator; trend‑following prototype with SMA50 and 50D SMA indicator; trade sorting fixes; data download (trades & performance); team carousel.
- Smart/Power DCA strategies and modeling (10‑07 → 10‑12)
  - Smart BTC DCA strategy with tests and math fixes; strategy ids/names; code metrics (scc) output.
  - Power‑law model exploration (params, fixes, and Bitbo matching); model price integrated into Smart DCA.
  - Power BTC DCA strategy added/refined; simulator refactors; volatility and drawdown indicators; HODL DD fix; UI polish.
  - Account modal balances; Python implementations for two strategies; Close Wallet component; wallet page refactor.
  - Journal and COCOMO stats added.

### Week of 2025‑10‑13 → 2025‑10‑17
- Portfolio/Wallet UX and trend strategy (10‑13 → 10‑14)
  - Portfolio sorting and UI tweaks; more deposits/withdrawals in modal; reverse sorting arrow; “max” actions; config modal improvements and descriptions.
  - Wallet history chart improvements; annotations refinement; faucet info moved to Asset card.
  - Trend BTC DCA introduced and iterated; strategy renames and cleanup.
- Reliability & gas handling (10‑15)
  - Asset chart fix; retry logic with `maxPriorityFeePerGas` and `maxFeePerGas`.
- On‑chain strategy upgrades and wallet ops (10‑16)
  - Trend DCA strategy (contracts) added and upgraded; add `onlyOwner` un‑register wallet; hook rename and rebalance context hook introduced.
- Strategy configuration, defaults, and charts (10‑17)
  - Consolidated/renamed default parameters across strategies; added strategy config panel and advanced options with persisted overrides.
  - Recharts Brush added to each chart (per‑chart zoom); removed global slider for responsiveness; UI copy tweaks; metrics update.
  - Strategy comparison technical document authored.

---

### Highlights & Impact
- Multiple BTC strategies shipped: Simple DCA, Smart DCA (adaptive), Power DCA (power‑law bands), Trend DCA (SMA50 with hysteresis/slope).
- End‑to‑end simulator with risk analytics (Sharpe/Sortino), signals, and export; now with per‑chart zooming for long intervals.
- Robust wallet/portfolio UI with live data, tables, config flows, and on‑chain operations (fees, upkeep, deploy scripts).
- Documentation and metrics: architecture, strategy docs, journal, COCOMO/scc code metrics.


