## Project Journal

### 2025-10-17
- Consolidated strategy parameter defaults and naming across the frontend strategies; introduced parameter configuration UI and refactors around default param handling.
- Added per-chart zoom via Recharts Brush for better performance on long intervals; removed global range slider. Minor copy and metrics updates.

### 2025-10-16
- Added Trend BTC DCA strategy (and related upgrades), including contract hooks and wallet management improvements (onlyOwner un-register).
- Polished UI (button alignment, naming), and expanded strategy set and rebalance context handling.

### 2025-10-15
- Fixed assets chart rendering; improved transaction fee handling with priority fee controls. Unified strategy naming.

### 2025-10-14
- Introduced and iterated on Trend BTC DCA; improved wallet history charts and annotations; UI copy tweaks and moved faucet info to asset card.

### 2025-10-13
- Portfolio and wallet UX improvements: sorting, pagination/visibility in modals, “max” actions, config detail; refined chart formatting and UI polish.

### 2025-10-12
- Shipped the new Power DCA strategy end-to-end, including simulator refactors and UI wiring. Added volatility and drawdown indicators, balances in the account modal, and a Close Wallet component. Also introduced Python implementations for two strategies, polished wallet page structure, and minor UX copy/icon updates.

### 2025-10-11
- Refactored the Portfolio page and improved the strategy configuration UX (full-screen modal, clearer title bar, more info during creation). Integrated Google Analytics, added a USDC faucet, and enabled auto-refresh on the wallet page alongside several copy updates.

### 2025-10-10
- Documented the system with an architecture diagram and refined the Portfolio Summary. Improved mobile layouts and added a Users page while extracting `WalletSummary` for reuse.

### 2025-10-09
- Advanced Smart DCA by adding a model price and calibrating a power-law model (with parameter tuning and fixes). Added deployment and update scripts for the strategy and refreshed docs and copy.

### 2025-10-08
- Expanded strategies with a trend-following approach and introduced `btc-dca-power-law-v1`. Improved onboarding, added loading states until all wallet data resolves, and enabled downloads for trades and performance. Mapped strategies to charts in the simulator, fixed sorting, added a team carousel, and organized the contracts page with tabs.

### 2025-10-07
- Implemented Smart BTC DCA with comprehensive tests and math fixes. Introduced user tracking, strategy IDs/names, small copy improvements, pool metrics, and added codebase metrics output (scc).

### 2025-10-06
- Improved onboarding for Coinbase Smart Wallet users and centralized chain switching mechanics. Added a Pool Management page with add-liquidity flow, an app tools client, and various build/copy fixes, plus footer links and icon updates.

### 2025-10-05
- Delivered a simple DCA strategy and major wallet/portfolio UX: wallet history chart, deposit/withdraw and swaps tables, strategy config (with quick open), closed wallet visibility, faucet info, and layout/copy refinements.

### 2025-10-04
- Integrated live price feeds and slippage protection. Added scripts to deploy the PowerWallet implementation, wired config addresses, fixed initialization issues, and introduced app/pool config, fees, and delete wallet flows. Improved mobile layout, added upkeep checks, and resolved several build/TypeScript/router issues.

### 2025-10-03
- Launched initial Portfolio and Wallet pages with deposit/withdraw flows and a dedicated smart contracts page. Updated contract upgradability, added deploy scripts, and made formatting/copy improvements.

### 2025-10-02
- Introduced core contracts: `WalletFactory`, `PowerWallet`, and the first simple strategy. Added view functions, Netlify configuration, and initial footer/copy tweaks.

### 2025-10-01
- Built analytics and simulation tooling: strategy simulator, price chart, RSI and signal charts, Sharpe/Sortino ratios, log-scale toggle, and chart visibility toggles. Refactored to support multiple strategies and DCA, improved Portfolio Summary and about section, and fixed various annotations/legend/autoreload issues.

### 2025-09-30
- Set up frontend scaffolding, added scripts, and created tests (SMA, gas). Exposed `getFullPriceHistory` view function and added a guard to skip price updates for historical gaps.

### 2025-09-29
- Project kickoff with first commit. Established test infrastructure, implemented Wilder's RSI and tests, improved deployment scripts, deduplicated contracts, updated prices, and stabilized initial tests.

