// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/IStrategy.sol";

interface IIndicatorsReaderV2 {
    function latestEwmaVolAnnualized(address token) external view returns (uint256 value1e8, uint256 ts);
    function latestDrawdown(address token) external view returns (uint256 value1e8, uint256 ts);
}

/**
 * @title SmartBtcDcaV2
 * @notice Adaptive BTC DCA with weekly cadence, optional threshold rebalancing to weight bands,
 *         and a volatility/drawdown-based kicker sourced from TechnicalIndicators.
 * @dev Initialization signature (abi.encode):
 *      initialize(
 *        address risk, address stable, address btcUsdFeed,
 *        address indicators,
 *        uint256 baseDcaStable,
 *        uint256 frequencySeconds,
 *        uint16 targetBtcBps,
 *        uint16 bandDeltaBps,
 *        uint16 bufferMultX,           // e.g., 9 → buffer = 9 × baseDcaStable
 *        uint16 cmaxMultX,             // e.g., 3 → kicker cap = 3 × baseDcaStable
 *        uint16 rebalanceCapBps,       // e.g., 500 = 5% of NAV cap per rebalance
 *        uint32 kKicker1e6,            // kKicker coefficient scaled by 1e6 (e.g., 50000 for 0.05)
 *        bool thresholdMode,
 *        string desc
 *      )
 */
contract SmartBtcDcaV2 is IStrategy {
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
    address public indicators;           // TechnicalIndicators contract
    uint8 public riskDecimals;
    uint8 public stableDecimals;

    uint256 public baseDcaStable;        // base DCA amount in stable decimals
    uint256 public frequency;            // seconds between evaluations
    uint256 public lastTimestamp;        // updated via onRebalanceExecuted
    address public authorizedWallet;

    uint16 public targetBtcBps;          // 7000 = 70%
    uint16 public bandDeltaBps;          // 2000 = ±20% (band around target)
    uint16 public bufferMultX;           // 9× base DCA buffer
    uint16 public cmaxMultX;             // 3× base DCA cap for kicker
    uint16 public rebalanceCapBps;       // cap single rebalance to % of NAV (e.g., 500 = 5%)
    uint32 public kKicker1e6;            // 0.05 → 50000 (multiplied by vol and dd)
    bool public thresholdMode;           // enable/disable band threshold rebalancing

    string private _description;
    string private _id;
    string private _name;

    event Initialized(address risk, address stable, address feed, address indicators);
    event Executed(uint256 when, uint8 actionKind, uint256 amountIn);

    function initialize(
        address _risk,
        address _stable,
        address _feed,
        address _indicators,
        uint256 _baseDcaStable,
        uint256 _frequency,
        uint16 _targetBtcBps,
        uint16 _bandDeltaBps,
        uint16 _bufferMultX,
        uint16 _cmaxMultX,
        uint16 _rebalanceCapBps,
        uint32 _kKicker1e6,
        bool _thresholdMode,
        string calldata desc
    ) external {
        require(_owner == address(0), "inited");
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);

        require(_risk != address(0) && _stable != address(0) && _feed != address(0), "addr");
        require(_frequency > 0 && _baseDcaStable > 0, "params");

        riskAsset = _risk;
        stableAsset = _stable;
        btcUsdFeed = _feed;
        indicators = _indicators;
        baseDcaStable = _baseDcaStable;
        frequency = _frequency;
        targetBtcBps = _targetBtcBps;
        bandDeltaBps = _bandDeltaBps;
        bufferMultX = _bufferMultX;
        cmaxMultX = _cmaxMultX;
        rebalanceCapBps = _rebalanceCapBps;
        kKicker1e6 = _kKicker1e6;
        thresholdMode = _thresholdMode;

        riskDecimals = IERC20Metadata(_risk).decimals();
        stableDecimals = IERC20Metadata(_stable).decimals();
        lastTimestamp = 0;
        _description = desc;
        _id = "smart-btc-dca-v2";
        _name = "Smart BTC DCA";

        emit Initialized(_risk, _stable, _feed, _indicators);
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

        // Read BTC/USD
        (, int256 p,,,) = AggregatorV3Interface(btcUsdFeed).latestRoundData();
        if (p <= 0) return (false, actions);
        uint256 price1e8 = uint256(p);

        uint256 riskBal = (riskBalances.length > 0) ? riskBalances[0] : 0;
        uint256 riskValue1e8 = riskDecimals > 0 ? (riskBal * price1e8) / (10 ** riskDecimals) : 0;
        uint256 stableValue1e8 = stableDecimals > 0 ? (stableBalance * (10 ** 8)) / (10 ** stableDecimals) : 0;
        uint256 nav1e8 = stableValue1e8 + riskValue1e8;
        if (nav1e8 == 0) return (false, actions);

        // Current weight of BTC
        uint256 wBtcBps = (riskValue1e8 * 10000) / nav1e8; // in bps
        uint256 lowerBps = targetBtcBps > bandDeltaBps ? uint256(targetBtcBps) - uint256(bandDeltaBps) : 0;
        uint256 upperBps = uint256(targetBtcBps) + uint256(bandDeltaBps);

        // Optional threshold rebalancing
        if (thresholdMode && nav1e8 > 0) {
            if (wBtcBps > upperBps && riskBal > 0) {
                // SELL down to upper band
                uint256 targetRiskValue1e8 = (nav1e8 * upperBps) / 10000;
                if (riskValue1e8 > targetRiskValue1e8) {
                    uint256 excess1e8 = riskValue1e8 - targetRiskValue1e8;
                    uint256 cap1e8 = (nav1e8 * rebalanceCapBps) / 10000;
                    uint256 tradeUsd1e8 = excess1e8 < cap1e8 ? excess1e8 : cap1e8;
                    // Convert USD (1e8) to risk amount
                    uint256 amountRisk = (tradeUsd1e8 * (10 ** riskDecimals)) / price1e8;
                    if (amountRisk > 0) {
                        actions = new SwapAction[](1);
                        actions[0] = SwapAction({ tokenIn: riskAsset, tokenOut: stableAsset, amountIn: amountRisk });
                        return (true, actions);
                    }
                }
            } else if (wBtcBps < lowerBps) {
                // BUY up to lower band
                uint256 targetRiskValue1e8 = (nav1e8 * lowerBps) / 10000;
                if (targetRiskValue1e8 > riskValue1e8) {
                    uint256 shortfall1e8 = targetRiskValue1e8 - riskValue1e8;
                    uint256 cap1e8 = (nav1e8 * rebalanceCapBps) / 10000;
                    uint256 tradeUsd1e8 = shortfall1e8 < cap1e8 ? shortfall1e8 : cap1e8;
                    // Also bound by available stable
                    uint256 maxUsd1e8FromStable = (stableBalance * (10 ** 8)) / (10 ** stableDecimals);
                    if (tradeUsd1e8 > maxUsd1e8FromStable) tradeUsd1e8 = maxUsd1e8FromStable;
                    if (tradeUsd1e8 > 0) {
                        // Convert USD (1e8) to stable amount
                        uint256 amountStable = (tradeUsd1e8 * (10 ** stableDecimals)) / (10 ** 8);
                        actions = new SwapAction[](1);
                        actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: amountStable });
                        return (true, actions);
                    }
                }
            }
        }

        // DCA + Kicker on evaluation days
        // Buffer target: bufferMultX × baseDcaStable
        uint256 bufferTargetStable = uint256(bufferMultX) * baseDcaStable;
        uint256 availableToSpend = 0;
        if (stableBalance > bufferTargetStable) {
            uint256 above = stableBalance - bufferTargetStable;
            availableToSpend = above < baseDcaStable ? above : baseDcaStable;
        }

        // Read indicators
        uint256 vol1e8 = 0; uint256 dd1e8 = 0;
        if (indicators != address(0)) {
            (vol1e8,) = IIndicatorsReaderV2(indicators).latestEwmaVolAnnualized(riskAsset);
            (dd1e8,) = IIndicatorsReaderV2(indicators).latestDrawdown(riskAsset);
        }
        // kickerUSD1e8 = kKicker * vol * dd * nav
        // kKicker1e6 scaled, vol1e8, dd1e8, nav1e8 → result scale 1e8
        uint256 kickerUsd1e8 = (uint256(kKicker1e6) * vol1e8 / 1e6);
        kickerUsd1e8 = (kickerUsd1e8 * dd1e8) / (10 ** 8);
        kickerUsd1e8 = (kickerUsd1e8 * nav1e8) / (10 ** 8);

        // Cap kicker to cmaxMultX × baseDcaStable
        uint256 kickerCap1e8 = (uint256(cmaxMultX) * baseDcaStable * (10 ** 8)) / (10 ** stableDecimals);
        if (kickerUsd1e8 > kickerCap1e8) kickerUsd1e8 = kickerCap1e8;

        // Total budget in USD 1e8, then to stable units
        uint256 baseUsd1e8 = (availableToSpend * (10 ** 8)) / (10 ** stableDecimals);
        uint256 totalUsd1e8 = baseUsd1e8 + kickerUsd1e8;
        // Bound by stable available
        uint256 maxUsd1e8Stable = (stableBalance * (10 ** 8)) / (10 ** stableDecimals);
        if (totalUsd1e8 > maxUsd1e8Stable) totalUsd1e8 = maxUsd1e8Stable;

        if (totalUsd1e8 > 0) {
            uint256 amountStableIn = (totalUsd1e8 * (10 ** stableDecimals)) / (10 ** 8);
            if (amountStableIn > 0) {
                actions = new SwapAction[](1);
                actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: amountStableIn });
                return (true, actions);
            }
        }

        return (false, actions);
    }

    function onRebalanceExecutedWithContext(SwapAction[] calldata /*actions*/) external {
        require(msg.sender == authorizedWallet, "unauthorized");
        
        lastTimestamp = block.timestamp;
        emit Executed(lastTimestamp, 0, 0);
    }

    // Owner setters
    
    function setBaseDcaStable(uint256 newBase) external onlyOwner { require(newBase > 0, "base"); baseDcaStable = newBase; }
    function setFrequency(uint256 newFrequency) external onlyOwner { require(newFrequency > 0, "freq"); frequency = newFrequency; }
    function setBuffer(uint16 newBufferMultX) external onlyOwner {
        bufferMultX = newBufferMultX;
    }

    function setKickerParams(uint32 newKKicker1e6, uint16 newCmaxMultX) external onlyOwner {
        kKicker1e6 = newKKicker1e6;
        cmaxMultX = newCmaxMultX;
    }

    function setThresholdMode(bool enabled) external onlyOwner { thresholdMode = enabled; }
    
    function setRebalanceParams(uint16 newTargetBps, uint16 newBandDeltaBps, uint16 newRebalanceCapBps) external onlyOwner {
        targetBtcBps = newTargetBps;
        bandDeltaBps = newBandDeltaBps;
        rebalanceCapBps = newRebalanceCapBps;
    }
    
    function setIndicators(address newIndicators) external onlyOwner { indicators = newIndicators; }
    function setAuthorizedWallet(address wallet_) external onlyOwner { authorizedWallet = wallet_; }
}




