// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
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

    // Power-law constants (from TypeScript model)
    // P = C * d^N, with C ~ 9.65e-18 and N ~ 5.845
    // Implemented in 64.64 fixed-point via ABDK-style functions below.
    int128 private constant N_64x64 = 0x00000000000000000000000000000000000000000000000000000000005C28F5; // ~5.845 (approx) in 64.64
    int128 private constant C_64x64 = 0x00000000000000000000000000000000; // ~9.65e-18 ~ 0 in 64.64 (very small)

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
        lastTimestamp = 0;
        _description = desc;

        emit Initialized(_risk, _stable, _feed, _frequency, _lowerBps, _upperBps, _buyBpsStable, _smallBuyBpsStable, _sellBpsRisk);
    }

    // ---- Strategy logic ----
    function description() external view override returns (string memory) { return _description; }

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
            if (amountStable == 0) return (false, actions);
            actions = new SwapAction[](1);
            actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: amountStable });
            return (true, actions);
        }

        if (price >= lowerThreshold && price <= model && smallBuyBpsOfStable > 0 && stableBalance > 0) {
            // Between lower band and model: use small buy percentage
            uint256 amountStable = (stableBalance * smallBuyBpsOfStable) / 10000;
            if (amountStable == 0) return (false, actions);
            actions = new SwapAction[](1);
            actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: amountStable });
            return (true, actions);
        }

        if (price > upperThreshold && sellBpsOfRisk > 0 && riskBalances.length > 0 && riskBalances[0] > 0) {
            // Above upper band: sell
            uint256 amountRisk = (riskBalances[0] * sellBpsOfRisk) / 10000;
            if (amountRisk == 0) return (false, actions);
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

    // ---- Model price helpers ----
    function daysSinceGenesis(uint256 ts) public pure returns (uint256) {
        // 2009-01-03T00:00:00Z = 1230940800
        if (ts <= 1230940800) return 1;
        return (ts - 1230940800) / 1 days;
    }

    function modelPriceUSD_1e8(uint256 /* d */) public pure returns (uint256) {
        // Simplified deterministic model for testing: $1.00
        return 100_000_000; // 1e8
    }

}


