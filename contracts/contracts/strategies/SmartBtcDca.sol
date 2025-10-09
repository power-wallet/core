// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/IStrategy.sol";
import "../utils/ABDKMath64x64.sol";

/**
 * @title SmartBtcDca
 * @notice Strategy that rebalances using a power-law BTC/USD price model with configurable bands and trade sizes.
 *         The model uses P(t) = C * d^N, where d is days since 2009-01-03, computed with fixed-point math on-chain.
 *         Buys when price is below the lower band; sells when price is above the upper band.
 */
contract SmartBtcDca is IStrategy {
    // ---- Minimal Ownable (initializer-style for clones) ----
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    modifier onlyOwner() { require(msg.sender == _owner, "owner"); _; }
    function owner() public view returns (address) { return _owner; }
    function transferOwnership(address newOwner) external onlyOwner { require(newOwner != address(0), "zero"); emit OwnershipTransferred(_owner, newOwner); _owner = newOwner; }

    // ---- Strategy config ----
    address public riskAsset;          // e.g., cbBTC (decimals riskDec)
    address public stableAsset;        // e.g., USDC  (decimals stableDec)
    address public btcUsdFeed;         // Chainlink BTC/USD (8 decimals typical)
    uint8 public riskDecimals;         // cached risk token decimals
    uint8 public stableDecimals;       // cached stable token decimals

    uint256 public frequency;          // seconds between evaluations
    uint256 public lastTimestamp;      // last executed timestamp, set in onRebalanceExecuted

    // Band thresholds expressed as bps around model
    // Buy if price <= model * (10000 - lowerBandBps) / 10000
    // Sell if price >= model * (10000 + upperBandBps) / 10000
    uint16 public lowerBandBps;        // e.g., 5000 = 50% below model
    uint16 public upperBandBps;        // e.g., 5000 = 50% above model

    // Trade sizes
    uint16 public buyBpsOfStable;      // portion of stable balance to spend on buy when below lower band, in bps
    uint16 public smallBuyBpsOfStable; // portion of stable balance to spend on buy when between lower band and model, in bps
    uint16 public sellBpsOfRisk;       // portion of risk balance to sell, in bps

    string private _description;
    string private _id;
    string private _name;

    // Power-law constants (from TypeScript model)
    // Model: P = A * d^n with A = 9.64e-18 and n = 5.8451
    // Precomputed 64.64 fixed-point constants for accuracy and gas efficiency.
    // N in 64.64:
    int128 private constant N_64x64 = 107823063785239700151; // 5.8451 in 64.64
    // log2(A) in 64.64 (negative signed value) for A=9.64e-18
    int128 private constant LOG2_A_64x64 = -1042714615336615593515;

    event Initialized(address risk, address stable, address feed, uint256 frequency, uint16 lowerBps, uint16 upperBps, uint16 buyBps, uint16 smallBuyBps, uint16 sellBps);
    event Executed(uint256 when, int256 decision, uint256 amountIn);

    // ---- Initialization ----
    // signature: initialize(address,address,address,uint256,uint16,uint16,uint16,uint16,uint16,string)
    function initialize(
        address _risk,
        address _stable,
        address _feed,
        uint256 _frequency,
        uint16 _lowerBps,
        uint16 _upperBps,
        uint16 _buyBpsStable,
        uint16 _smallBuyBpsStable,
        uint16 _sellBpsRisk,
        string calldata desc
    ) external {
        require(_owner == address(0), "inited");
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);

        require(_risk != address(0) && _stable != address(0) && _feed != address(0), "addr");
        require(_frequency > 0, "freq");
        require(_buyBpsStable <= 10000 && _smallBuyBpsStable <= 10000 && _sellBpsRisk <= 10000, "bps");

        riskAsset = _risk;
        stableAsset = _stable;
        btcUsdFeed = _feed;
        frequency = _frequency;
        lowerBandBps = _lowerBps;
        upperBandBps = _upperBps;
        buyBpsOfStable = _buyBpsStable;
        smallBuyBpsOfStable = _smallBuyBpsStable;
        sellBpsOfRisk = _sellBpsRisk;
        // Cache token decimals (best-effort)
        riskDecimals = IERC20Metadata(_risk).decimals();
        stableDecimals = IERC20Metadata(_stable).decimals();
        lastTimestamp = 0;
        _description = desc;
        _id = "btc-dca-power-law-v1";
        _name = "Smart BTC DCA (Power Law)";

        emit Initialized(_risk, _stable, _feed, _frequency, _lowerBps, _upperBps, _buyBpsStable, _smallBuyBpsStable, _sellBpsRisk);
    }

    // ---- Strategy logic ----
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

        // Current BTC/USD from Chainlink (8 decimals typical)
        (, int256 p,,,) = AggregatorV3Interface(btcUsdFeed).latestRoundData();
        if (p <= 0) return (false, actions);
        uint256 price = uint256(p); // 1e8

        // Compute model price in 1e8 using power-law
        uint256 d = daysSinceGenesis(block.timestamp);
        uint256 model = modelPriceUSD_1e8(d);

        // Bands
        uint256 lowerThreshold = (model * (10000 - lowerBandBps)) / 10000;
        uint256 upperThreshold = (model * (10000 + upperBandBps)) / 10000;

        // Decide based on price zones
        if (price < lowerThreshold && buyBpsOfStable > 0 && stableBalance > 0) {
            // Below lower band: use full buy percentage
            uint256 amountStable = (stableBalance * buyBpsOfStable) / 10000;
            // Enforce minimum $1 worth of stable to avoid micro-swaps
            uint256 minStableUnits = 10 ** stableDecimals;
            if (amountStable < minStableUnits) return (false, actions);
            actions = new SwapAction[](1);
            actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: amountStable });
            return (true, actions);
        }

        if (price >= lowerThreshold && price <= model && smallBuyBpsOfStable > 0 && stableBalance > 0) {
            // Between lower band and model: use small buy percentage
            uint256 amountStable = (stableBalance * smallBuyBpsOfStable) / 10000;
            // Enforce minimum $1 worth of stable to avoid micro-swaps
            uint256 minStableUnits = 10 ** stableDecimals;
            if (amountStable < minStableUnits) return (false, actions);
            actions = new SwapAction[](1);
            actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: amountStable });
            return (true, actions);
        }

        if (price > upperThreshold && sellBpsOfRisk > 0 && riskBalances.length > 0 && riskBalances[0] > 0) {
            // Above upper band: sell
            uint256 amountRisk = (riskBalances[0] * sellBpsOfRisk) / 10000;
            // Enforce minimum $1 worth of risk asset (using Chainlink price 1e8)
            // riskValue1e8 = amountRisk * price / 10^riskDecimals
            uint256 denom = 10 ** riskDecimals;
            uint256 riskValue1e8 = (amountRisk * price) / denom;
            if (riskValue1e8 < 1e8) return (false, actions);
            actions = new SwapAction[](1);
            actions[0] = SwapAction({ tokenIn: riskAsset, tokenOut: stableAsset, amountIn: amountRisk });
            return (true, actions);
        }

        return (false, actions);
    }

    function onRebalanceExecuted() external {
        lastTimestamp = block.timestamp;
        emit Executed(lastTimestamp, 0, 0);
    }

    // ---- Parameter setters ----
    function setBands(uint16 newLowerBps, uint16 newUpperBps) external onlyOwner { lowerBandBps = newLowerBps; upperBandBps = newUpperBps; }
    function setTradePercents(uint16 newBuyBpsStable, uint16 newSmallBuyBpsStable, uint16 newSellBpsRisk) external onlyOwner { 
        require(newBuyBpsStable <= 10000 && newSmallBuyBpsStable <= 10000 && newSellBpsRisk <= 10000, "bps"); 
        buyBpsOfStable = newBuyBpsStable; 
        smallBuyBpsOfStable = newSmallBuyBpsStable;
        sellBpsOfRisk = newSellBpsRisk; 
    }
    function setFrequency(uint256 newFrequency) external onlyOwner { require(newFrequency > 0, "freq"); frequency = newFrequency; }
    function setFeed(address newFeed) external onlyOwner { require(newFeed != address(0), "feed"); btcUsdFeed = newFeed; }

    // ---- Testing helpers (view) ----
    function getModelAndBands() external view returns (uint256 model, uint256 lowerThreshold, uint256 upperThreshold) {
        uint256 d = daysSinceGenesis(block.timestamp);
        model = modelPriceUSD_1e8(d);
        lowerThreshold = (model * (10000 - lowerBandBps)) / 10000;
        upperThreshold = (model * (10000 + upperBandBps)) / 10000;
    }

    // ---- Model price helpers ----
    function daysSinceGenesis(uint256 ts) public pure returns (uint256) {
        // 2009-01-03T00:00:00Z = 1230940800
        if (ts <= 1230940800) return 1;
        return (ts - 1230940800) / 1 days;
    }

    function modelPriceUSD_1e8(uint256 d) public pure returns (uint256) {
        if (d < 1) d = 1;
        // Compute log2(price) = log2(C) + N * log2(d)
        int128 d64 = ABDKMath64x64.fromUInt(d);
        int128 log2d = ABDKMath64x64.log_2(d64);
        int128 log2price = ABDKMath64x64.add(LOG2_A_64x64, ABDKMath64x64.mul(log2d, N_64x64));
        int128 price64 = _exp2_decomposed(log2price);

        // Convert 64.64 to 1e8
        uint256 scaled = (uint256(uint128(price64)) * 1e8) >> 64;
        if (scaled == 0) return 1; // clamp to 1 to avoid zero
        return scaled;
    }

    // ---- Debug helpers (view, safe for tests) ----
    function debugLog2d(uint256 d) external pure returns (int128) {
        if (d < 1) d = 1;
        int128 d64 = ABDKMath64x64.fromUInt(d);
        return ABDKMath64x64.log_2(d64);
    }

    function debugLog2Price(uint256 d) external pure returns (int128) {
        if (d < 1) d = 1;
        int128 d64 = ABDKMath64x64.fromUInt(d);
        int128 log2d = ABDKMath64x64.log_2(d64);
        return ABDKMath64x64.add(LOG2_A_64x64, ABDKMath64x64.mul(log2d, N_64x64));
    }

    function _exp2_decomposed(int128 x) internal pure returns (int128) {
        // Decompose x into integer and fractional parts: x = k + f, with f in [0,1)
        int128 one = 0x10000000000000000; // 1.0 in 64.64
        int256 xi = int256(x);
        int256 k = xi >> 64; // integer part
        int128 f = int128(xi - (k << 64)); // fractional part in 64.64

        // Approximate 2^f using e^{f * ln 2} with 5th-order Taylor
        int128 ln2 = 0x0B17217F7D1CF79AC; // ~0.69314718056 in 64.64
        int128 t = ABDKMath64x64.mul(f, ln2);
        int128 term = one;                          // 1
        term = ABDKMath64x64.add(term, t);          // + t
        int128 t2 = ABDKMath64x64.mul(t, t);
        term = ABDKMath64x64.add(term, ABDKMath64x64.div(t2, ABDKMath64x64.fromUInt(2))); // + t^2/2
        int128 t3 = ABDKMath64x64.mul(t2, t);
        term = ABDKMath64x64.add(term, ABDKMath64x64.div(t3, ABDKMath64x64.fromUInt(6))); // + t^3/6
        int128 t4 = ABDKMath64x64.mul(t3, t);
        term = ABDKMath64x64.add(term, ABDKMath64x64.div(t4, ABDKMath64x64.fromUInt(24))); // + t^4/24
        int128 t5 = ABDKMath64x64.mul(t4, t);
        term = ABDKMath64x64.add(term, ABDKMath64x64.div(t5, ABDKMath64x64.fromUInt(120))); // + t^5/120

        // Scale by 2^k using shifts (loop multiply/divide by two)
        int128 two = 0x20000000000000000; // 2.0 in 64.64
        if (k > 0) {
            uint256 times = uint256(int256(k));
            for (uint256 i = 0; i < times; i++) {
                term = ABDKMath64x64.mul(term, two);
            }
        } else if (k < 0) {
            uint256 times = uint256(int256(-k));
            for (uint256 i = 0; i < times; i++) {
                term = ABDKMath64x64.div(term, two);
            }
        }
        return term;
    }


}


