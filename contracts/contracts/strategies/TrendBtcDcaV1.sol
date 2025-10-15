// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/IStrategy.sol";
import "../core/TechnicalIndicators.sol";

/**
 * @title TrendBtcDcaV1
 * @notice Ports frontend Trend BTC DCA logic (SMA50 trend filter with hysteresis and slope gate,
 *         weekly evaluation, DCA mode when trend is down with discount boost) into an on-chain strategy.
 *
 * Core rules (mirroring frontend btcTrendFollowing.ts):
 * - Evaluate on a fixed cadence (e.g., every 5 days)
 * - Compute SMA50 from TechnicalIndicators' daily closes
 * - Hysteresis band: upThresh = SMA * (1 + hystBps/10000), dnThresh = SMA * (1 - hystBps/10000)
 * - Slope gate: SMA(today) > SMA(today - slopeLookbackDays)
 * - State machine:
 *    - If not in DCA mode and price > upThresh and slopeOk: go/stay full-BTC (BUY all stable)
 *    - If not in DCA mode and (price < dnThresh or !slopeOk): SELL all BTC to stable, enter DCA mode
 *    - If in DCA mode and not enterUp and stable > minCash: DCA
 *         spend = min(stable, stable * dcaPct)
 *         if price discount vs SMA >= discountBelowSmaPct, spend *= dcaBoostMultiplier (bounded by stable)
 *         if spend >= minSpendUsd (in stable units), BUY spend of stable into BTC
 *    - If in DCA mode and enterUp and stable > 0: BUY all stable and exit DCA mode
 */
contract TrendBtcDcaV1 is IStrategy {
    // ---- Minimal Ownable (initializer-style for clones) ----
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    modifier onlyOwner() { require(msg.sender == _owner, "owner"); _; }
    function owner() public view returns (address) { return _owner; }
    function transferOwnership(address newOwner) external onlyOwner { require(newOwner != address(0), "zero"); emit OwnershipTransferred(_owner, newOwner); _owner = newOwner; }

    // ---- Config ----
    address public riskAsset;            // e.g., cbBTC
    address public stableAsset;          // e.g., USDC
    address public btcUsdFeed;           // Chainlink BTC/USD (1e8)
    TechnicalIndicators public indicators; // Provides daily closes and SMA
    uint8 public riskDecimals;
    uint8 public stableDecimals;

    // Evaluation cadence
    uint256 public frequency;            // seconds between evaluations (e.g., ~5 days)
    uint256 public lastTimestamp;        // updated after execution

    // Authorized wallet that is allowed to call lifecycle hooks
    address public authorizedWallet;

    // SMA and trend settings
    uint16 public smaLength;             // default 50 (must be within indicators limits)
    uint16 public hystBps;               // hysteresis band in bps (e.g., 150 = 1.5%)
    uint16 public slopeLookbackDays;     // slope lookback window in days (e.g., 14)

    // DCA settings
    uint16 public dcaPctBps;             // base DCA percent of stable in bps (e.g., 500 = 5%)
    uint16 public discountBelowSmaPct;   // percent threshold (e.g., 15)
    uint16 public dcaBoostMultiplier;    // multiplier when discounted (e.g., 2)
    uint256 public minCashStable;        // minimum stable units to allow DCA (e.g., $100 in stable decimals)
    uint256 public minSpendStable;       // minimum spend per DCA in stable units (e.g., $1)

    // Internal state tracking for DCA mode
    bool public inDcaMode;

    string private _description;
    string private _id;
    string private _name;

    event Initialized(address risk, address stable, address feed, address indicators);
    event Executed(uint256 when, uint8 actionKind, uint256 amountIn, bool inDcaModeAfter);

    /**
     * @dev Initialization signature:
     * initialize(
     *   address risk,
     *   address stable,
     *   address btcFeed,
     *   address indicators,
     *   uint256 frequencySeconds,
     *   uint16 smaLen,
     *   uint16 hystBps_,
     *   uint16 slopeLookbackDays_,
     *   uint16 dcaPctBps_,
     *   uint16 discountBelowSmaPct_,
     *   uint16 dcaBoostMultiplier_,
     *   uint256 minCashStable_,
     *   uint256 minSpendStable_,
     *   string desc
     * )
     */
    function initialize(
        address _risk,
        address _stable,
        address _btcFeed,
        address _indicators,
        uint256 _frequency,
        uint16 _smaLen,
        uint16 _hystBps,
        uint16 _slopeLookbackDays,
        uint16 _dcaPctBps,
        uint16 _discountBelowSmaPct,
        uint16 _dcaBoostMultiplier,
        uint256 _minCashStable,
        uint256 _minSpendStable,
        string calldata desc
    ) external {
        require(_owner == address(0), "inited");
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);

        require(_risk != address(0) && _stable != address(0) && _btcFeed != address(0), "addr");
        require(_frequency > 0, "freq");
        require(_dcaPctBps <= 10000 && _dcaBoostMultiplier >= 1, "params");

        riskAsset = _risk;
        stableAsset = _stable;
        btcUsdFeed = _btcFeed;
        indicators = TechnicalIndicators(_indicators);
        frequency = _frequency;
        smaLength = _smaLen;
        hystBps = _hystBps;
        slopeLookbackDays = _slopeLookbackDays;
        dcaPctBps = _dcaPctBps;
        discountBelowSmaPct = _discountBelowSmaPct;
        dcaBoostMultiplier = _dcaBoostMultiplier;
        minCashStable = _minCashStable;
        minSpendStable = _minSpendStable;
        inDcaMode = false; // start out of DCA mode

        riskDecimals = IERC20Metadata(_risk).decimals();
        stableDecimals = IERC20Metadata(_stable).decimals();
        lastTimestamp = 0;
        _description = desc;
        _id = "trend-btc-dca-v1";
        _name = "Trend BTC DCA";

        emit Initialized(_risk, _stable, _btcFeed, _indicators);
    }

    function description() external view override returns (string memory) { return _description; }
    function id() external view override returns (string memory) { return _id; }
    function name() external view override returns (string memory) { return _name; }

    function shouldRebalance(
        address stable,
        address[] calldata risk,
        uint256 stableBalance,
        uint256[] calldata riskBalances
    ) external view override returns (bool needsRebalance, SwapAction[] memory actions) {
        if (stable != stableAsset) return (false, actions);
        if (risk.length == 0 || risk[0] != riskAsset) return (false, actions);
        if (block.timestamp < lastTimestamp + frequency) return (false, actions);

        // Need Chainlink BTC price and SMA from indicators
        (, int256 p,,,) = AggregatorV3Interface(btcUsdFeed).latestRoundData();
        if (p <= 0) return (false, actions);
        uint256 price1e8 = uint256(p);

        // Fetch SMA; will revert if insufficient data or out-of-range period
        uint256 sma1e8 = indicators.calculateSMA(riskAsset, smaLength);

        // Hysteresis thresholds in 1e8
        uint256 upThresh1e8 = (sma1e8 * (10000 + hystBps)) / 10000;
        uint256 dnThresh1e8 = (sma1e8 * (10000 - hystBps)) / 10000;

        // Slope gate: SMA(today) > SMA(today - slopeLookbackDays)
        bool slopeOk = _smaSlopeUp(riskAsset, smaLength, slopeLookbackDays);
        bool enterUp = price1e8 > upThresh1e8 && slopeOk;
        bool exitUp = price1e8 < dnThresh1e8 || !slopeOk;

        uint256 riskBal = (riskBalances.length > 0) ? riskBalances[0] : 0;

        if (!inDcaMode && enterUp && stableBalance > 0) {
            // BUY 100% stable into BTC
            actions = new SwapAction[](1);
            actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: stableBalance });
            return (true, actions);
        }

        if (!inDcaMode && exitUp && riskBal > 0) {
            // SELL 100% BTC to stable; enter DCA mode
            actions = new SwapAction[](1);
            actions[0] = SwapAction({ tokenIn: riskAsset, tokenOut: stableAsset, amountIn: riskBal });
            return (true, actions);
        }

        if (inDcaMode && !enterUp && stableBalance > minCashStable) {
            // DCA gently while trend is not up
            uint256 spend = (stableBalance * dcaPctBps) / 10000;
            // discount = 1 - price/sma (in percent)
            if (sma1e8 > 0) {
                uint256 discountPct = 0;
                if (price1e8 < sma1e8) {
                    // discountPct = (1 - price/sma) * 100
                    discountPct = ((sma1e8 - price1e8) * 100) / sma1e8;
                }
                if (discountPct >= discountBelowSmaPct) {
                    uint256 boosted = spend * uint256(dcaBoostMultiplier);
                    spend = boosted < stableBalance ? boosted : stableBalance;
                }
            }
            if (spend >= minSpendStable) {
                actions = new SwapAction[](1);
                actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: spend });
                return (true, actions);
            }
        }

        if (inDcaMode && enterUp && stableBalance > 0) {
            // Switch from DCA to full BTC when trend resumes
            actions = new SwapAction[](1);
            actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: stableBalance });
            return (true, actions);
        }

        return (false, actions);
    }

    // richer hook: wallet can pass executed actions as context
    function onRebalanceExecutedWithContext(SwapAction[] calldata actions) external {
        require(msg.sender == authorizedWallet, "unauthorized");
        
        lastTimestamp = block.timestamp;
        bool sawSellRisk = false;
        bool sawBuyRisk = false;
        for (uint256 i = 0; i < actions.length; i++) {
            if (actions[i].tokenIn == riskAsset && actions[i].tokenOut == stableAsset) {
                sawSellRisk = true;
            }
            if (actions[i].tokenIn == stableAsset && actions[i].tokenOut == riskAsset) {
                sawBuyRisk = true;
            }
        }
        if (sawSellRisk) inDcaMode = true;
        if (sawBuyRisk) inDcaMode = false;
        emit Executed(lastTimestamp, 0, 0, inDcaMode);
    }

    // ---- Owner setters ----
    function setFrequency(uint256 newFrequency) external onlyOwner { require(newFrequency > 0, "freq"); frequency = newFrequency; }
    function setSmaParams(uint16 newSmaLen, uint16 newHystBps, uint16 newSlopeLookback) external onlyOwner {
        smaLength = newSmaLen; hystBps = newHystBps; slopeLookbackDays = newSlopeLookback;
    }
    function setDcaParams(uint16 newDcaPctBps, uint16 newDiscountPct, uint16 newBoostMult, uint256 newMinCash, uint256 newMinSpend) external onlyOwner {
        require(newDcaPctBps <= 10000 && newBoostMult >= 1, "params");
        dcaPctBps = newDcaPctBps; discountBelowSmaPct = newDiscountPct; dcaBoostMultiplier = newBoostMult; minCashStable = newMinCash; minSpendStable = newMinSpend;
    }
    function setFeeds(address newBtcFeed, address newIndicators) external onlyOwner { if (newBtcFeed != address(0)) btcUsdFeed = newBtcFeed; if (newIndicators != address(0)) indicators = TechnicalIndicators(newIndicators); }
    function setInDcaMode(bool enabled) external onlyOwner { inDcaMode = enabled; }
    function setAuthorizedWallet(address wallet_) external onlyOwner { authorizedWallet = wallet_; }

    // ---- Internal helpers ----
    function _smaSlopeUp(address token, uint256 period, uint256 lookbackDays) internal view returns (bool) {
        if (lookbackDays == 0) return true;
        // We approximate slope by comparing SMA(period) using current window vs window shifted by 'lookbackDays'.
        // TechnicalIndicators exposes full history; we reconstruct SMAs by slicing. For gas, we approximate by
        // comparing last SMA with SMA computed on a window that ends lookbackDays earlier: SMA_t vs SMA_{t-lookback}.

        // Fetch price history count to ensure we have enough data
        TechnicalIndicators.DailyPrice[] memory recent = indicators.getLatestPrices(token, period + lookbackDays);
        if (recent.length < period + lookbackDays) return true; // if insufficient, be permissive like TS default

        // Compute SMA at t (last 'period' entries)
        uint256 sumNow = 0;
        for (uint256 i = recent.length - period; i < recent.length; i++) {
            sumNow += recent[i].price;
        }
        uint256 smaNow1e8 = sumNow / period;

        // Compute SMA at t - lookbackDays (the 'period' entries ending lookbackDays earlier)
        uint256 sumPrev = 0;
        uint256 endPrev = recent.length - lookbackDays; // exclusive
        uint256 startPrev = endPrev - period;
        for (uint256 i = startPrev; i < endPrev; i++) {
            sumPrev += recent[i].price;
        }
        uint256 smaPrev1e8 = sumPrev / period;
        return smaNow1e8 > smaPrev1e8;
    }
}


