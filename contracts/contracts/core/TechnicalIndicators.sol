// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

/**
 * @title TechnicalIndicators
 * @notice Calculates and stores technical indicators (RSI, SMA) for trading strategy
 * @dev Uses Chainlink price feeds and stores daily closes for calculations
 */
contract TechnicalIndicators is Initializable, OwnableUpgradeable, UUPSUpgradeable, AutomationCompatibleInterface {
    struct DailyPrice {
        uint256 timestamp;  // UTC midnight (start of the day)
        uint256 price;      // Price scaled by 1e8
    }

    struct TokenConfig {
        address priceFeed;
        uint256 lastUpdateTimestamp;
    }

    // Storage
    mapping(address => DailyPrice[]) public priceHistory;  // token => prices
    mapping(address => TokenConfig) public tokenConfigs;   // token => config
    address[] public trackedTokens;  // Array of tokens for automation updates

    // Constants
    uint256 public constant PRICE_DECIMALS = 8;
    uint256 public constant SCALE = 10**PRICE_DECIMALS;
    
    // Indicator parameters (from Python strategy)
    uint256 public constant RSI_PERIOD = 8;           // RSI period for BTC and ETH
    // Volatility (EWMA) config
    uint16 public constant LAMBDA_BPS = 9400;         // λ = 0.94 in basis points
    uint256 public constant SQRT_365_1e8 = 1910497317; // sqrt(365) * 1e8
    
    // Parameter limits for configurable indicators
    uint256 public constant MIN_SMA_PERIOD = 5;
    uint256 public constant MAX_SMA_PERIOD = 200;
    uint256 public constant MIN_ETHBTC_RSI_PERIOD = 5;
    uint256 public constant MAX_ETHBTC_RSI_PERIOD = 50;

    // Events
    event PriceAdded(address token, uint256 timestamp, uint256 price);
    event TokenConfigured(address token, address priceFeed);

    // Precomputed indicator storage (per token)
    // EWMA variance of daily simple returns r (scaled 1e8); sigma2 is scaled 1e16
    mapping(address => uint256) public ewmaSigma2_1e16;
    mapping(address => uint256) public latestVolAnnualized1e8; // sqrt(ewmaSigma2) * sqrt(365)
    mapping(address => uint256) public runningPeak1e8;         // running peak of price (1e8)
    mapping(address => uint256) public latestDrawdown1e8;      // percentage drawdown - 1e8 - price/peak * 1e8
    mapping(address => uint256) public latestIndicatorsTs;     // last update day (UTC midnight)

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the contract with historical price data
     * @param tokens Array of token addresses
     * @param priceFeeds Array of Chainlink price feed addresses
     * @param historicalPrices Array of historical prices for each token
     * @param startTimestamps Array of start timestamps for historical data
     */
    function initialize(
        address[] calldata tokens,
        address[] calldata priceFeeds,
        uint256[][] calldata historicalPrices,  // [token][day] = price
        uint256[] calldata startTimestamps      // UTC midnight for each token
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        require(tokens.length == priceFeeds.length, "Length mismatch");
        require(tokens.length == historicalPrices.length, "Length mismatch");
        require(tokens.length == startTimestamps.length, "Length mismatch");

        // Initialize historical data and token configs
        trackedTokens = tokens;
        for (uint256 i = 0; i < tokens.length; i++) {
            tokenConfigs[tokens[i]] = TokenConfig({
                priceFeed: priceFeeds[i],
                lastUpdateTimestamp: 0
            });

            uint256 startTime = startTimestamps[i];
            for (uint256 j = 0; j < historicalPrices[i].length; j++) {
                priceHistory[tokens[i]].push(DailyPrice({
                    timestamp: startTime + (j * 1 days),
                    price: historicalPrices[i][j]
                }));
            }

            emit TokenConfigured(tokens[i], priceFeeds[i]);
        }
    }

    /**
     * @notice Updates daily prices for specified tokens using Chainlink price feeds
     * @param tokens Array of token addresses to update prices for
     */
    function updateDailyPrices(address[] calldata tokens) external {
        uint256 today = block.timestamp - (block.timestamp % 1 days);
        
        // Convert calldata to memory for internal function
        address[] memory tokensMemory = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            tokensMemory[i] = tokens[i];
        }
        
        _updatePrices(tokensMemory, today);
    }

    /**
     * @notice Calculates Simple Moving Average (SMA) for a token
     * @param token Token address
     * @param period SMA period (must be between MIN_SMA_PERIOD and MAX_SMA_PERIOD)
     * @return SMA value scaled by SCALE
     */
    function calculateSMA(address token, uint256 period) public view returns (uint256) {
        require(period >= MIN_SMA_PERIOD && period <= MAX_SMA_PERIOD, "Period out of range");
        
        DailyPrice[] storage prices = priceHistory[token];
        require(prices.length >= period, "Insufficient data");

        uint256 sum;
        for (uint256 i = prices.length - period; i < prices.length; i++) {
            sum += prices[i].price;
        }

        return sum / period;
    }

    /**
     * @notice Calculates Relative Strength Index (RSI) for a token
     * @param token Token address
     * @param period RSI period
     * @return RSI value scaled by SCALE (0-100 * SCALE)
     */
    function calculateRSI(address token, uint256 period) public view returns (uint256) {
        DailyPrice[] storage prices = priceHistory[token];
        require(prices.length >= period + 1, "Insufficient data");
        require(period > 0, "Invalid period");

        uint256 avgGain;
        uint256 avgLoss;

        // First pass: calculate initial averages
        for (uint256 i = prices.length - period - 1; i < prices.length - 1; i++) {
            if (prices[i + 1].price > prices[i].price) {
                avgGain += prices[i + 1].price - prices[i].price;
            } else {
                avgLoss += prices[i].price - prices[i + 1].price;
            }
        }

        avgGain = (avgGain * SCALE) / period;
        avgLoss = (avgLoss * SCALE) / period;

        // Calculate RSI
        if (avgLoss == 0) {
            return 100 * SCALE;
        }

        uint256 rs = (avgGain * SCALE) / avgLoss;
        return (100 * SCALE) - ((100 * SCALE * SCALE) / (SCALE + rs));
    }

    /**
     * @notice Calculates Wilder's Smoothed RSI for a token (industry standard)
     * @dev Uses exponential smoothing: avgGain = (prevAvg * (period-1) + currentGain) / period
     * @param token Token address
     * @param period RSI period
     * @return RSI value scaled by SCALE (0-100 * SCALE)
     */
    function calculateWildersRSI(address token, uint256 period) public view returns (uint256) {
        DailyPrice[] storage prices = priceHistory[token];
        require(prices.length >= period + 1, "Insufficient data");
        require(period > 0, "Invalid period");

        // Calculate initial averages from first 'period' changes
        uint256 sumGain;
        uint256 sumLoss;
        
        for (uint256 i = 0; i < period; i++) {
            if (prices[i + 1].price > prices[i].price) {
                sumGain += prices[i + 1].price - prices[i].price;
            } else {
                sumLoss += prices[i].price - prices[i + 1].price;
            }
        }
        
        // Initial averages (scaled)
        uint256 avgGain = (sumGain * SCALE) / period;
        uint256 avgLoss = (sumLoss * SCALE) / period;
        
        // Apply Wilder's smoothing for remaining periods
        // Formula: avgGain = (prevAvgGain * (period - 1) + currentGain) / period
        for (uint256 i = period; i < prices.length - 1; i++) {
            uint256 currentGain;
            uint256 currentLoss;
            
            if (prices[i + 1].price > prices[i].price) {
                currentGain = (prices[i + 1].price - prices[i].price) * SCALE;
            } else {
                currentLoss = (prices[i].price - prices[i + 1].price) * SCALE;
            }
            
            // Wilder's exponential smoothing
            avgGain = (avgGain * (period - 1) + currentGain) / period;
            avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
        }
        
        // Calculate RSI
        if (avgLoss == 0) {
            return 100 * SCALE;
        }
        
        uint256 rs = (avgGain * SCALE) / avgLoss;
        return (100 * SCALE) - ((100 * SCALE * SCALE) / (SCALE + rs));
    }

    /**
     * @notice Calculates RSI for ETH/BTC ratio
     * @param ethToken ETH token address
     * @param btcToken BTC token address
     * @param period RSI period (must be between MIN_ETHBTC_RSI_PERIOD and MAX_ETHBTC_RSI_PERIOD)
     * @return RSI value scaled by SCALE (0-100 * SCALE)
     */
    function calculateEthBtcRSI(address ethToken, address btcToken, uint256 period) public view returns (uint256) {
        require(period >= MIN_ETHBTC_RSI_PERIOD && period <= MAX_ETHBTC_RSI_PERIOD, "Period out of range");
        
        DailyPrice[] storage ethPrices = priceHistory[ethToken];
        DailyPrice[] storage btcPrices = priceHistory[btcToken];
        
        require(ethPrices.length == btcPrices.length, "Price history length mismatch");
        require(ethPrices.length >= period + 1, "Insufficient data");

        // Create ETH/BTC ratio prices
        uint256[] memory ratioPrices = new uint256[](ethPrices.length);
        for (uint256 i = 0; i < ethPrices.length; i++) {
            require(ethPrices[i].timestamp == btcPrices[i].timestamp, "Timestamp mismatch");
            ratioPrices[i] = (ethPrices[i].price * SCALE) / btcPrices[i].price;
        }

        // Calculate RSI on ratio prices
        uint256 avgGain;
        uint256 avgLoss;

        // First pass: calculate initial averages
        for (uint256 i = ratioPrices.length - period - 1; i < ratioPrices.length - 1; i++) {
            if (ratioPrices[i + 1] > ratioPrices[i]) {
                avgGain += ratioPrices[i + 1] - ratioPrices[i];
            } else {
                avgLoss += ratioPrices[i] - ratioPrices[i + 1];
            }
        }

        avgGain = (avgGain * SCALE) / period;
        avgLoss = (avgLoss * SCALE) / period;

        // Calculate RSI
        if (avgLoss == 0) {
            return 100 * SCALE;
        }

        uint256 rs = (avgGain * SCALE) / avgLoss;
        return (100 * SCALE) - ((100 * SCALE * SCALE) / (SCALE + rs));
    }

    /**
     * @notice Gets the complete price history for a token
     * @param token Token address
     * @return Array of all DailyPrice structs for the token
     */
    function getFullPriceHistory(address token) external view returns (DailyPrice[] memory) {
        DailyPrice[] storage prices = priceHistory[token];
        require(prices.length > 0, "No price history");
        
        // Create a memory copy of the entire price history
        DailyPrice[] memory result = new DailyPrice[](prices.length);
        for (uint256 i = 0; i < prices.length; i++) {
            result[i] = prices[i];
        }
        
        return result;
    }

    /**
     * @notice Gets historical price data for a token within a time range
     * @param token Token address
     * @param startTime Start timestamp (inclusive)
     * @param endTime End timestamp (exclusive)
     * @return Array of DailyPrice structs
     */
    function getPriceHistory(
        address token,
        uint256 startTime,
        uint256 endTime
    ) external view returns (DailyPrice[] memory) {
        DailyPrice[] storage prices = priceHistory[token];
        require(prices.length > 0, "No price history");
        
        // Find start (first index with ts >= startTime) and end (first index with ts >= endTime)
        uint256 startIdx = 0;
        uint256 endIdx = prices.length;
        bool startFound = false;

        for (uint256 i = 0; i < prices.length; i++) {
            if (!startFound && prices[i].timestamp >= startTime) {
                startIdx = i;
                startFound = true;
            }
            // endTime is exclusive
            if (prices[i].timestamp >= endTime) {
                endIdx = i;
                break;
            }
        }
        
        require(startFound && startIdx < endIdx, "Invalid time range");
        
        uint256 length = endIdx - startIdx;
        DailyPrice[] memory result = new DailyPrice[](length);
        for (uint256 j = 0; j < length; j++) {
            result[j] = prices[startIdx + j];
        }
        return result;
    }

    /**
     * @notice Gets the most recent prices for a token
     * @param token Token address
     * @param count Number of prices to return
     * @return Array of most recent DailyPrice structs
     */
    function getLatestPrices(address token, uint256 count) 
        external 
        view 
        returns (DailyPrice[] memory) 
    {
        DailyPrice[] storage prices = priceHistory[token];
        require(prices.length > 0, "No price history");
        require(count > 0, "Invalid count");
        
        uint256 length = count > prices.length ? prices.length : count;
        DailyPrice[] memory result = new DailyPrice[](length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = prices[prices.length - length + i];
        }
        
        return result;
    }

    /**
     * @notice Chainlink Automation check if upkeep is needed
     * @dev Called by Chainlink Keeper to check if daily price update is needed
     * @dev Will return false if gap detected to prevent corrupting price history
     * @param checkData Not used in this implementation
     * @return upkeepNeeded True if update needed and no gaps detected
     * @return performData Encoded array of tracked tokens to update
     */
    function checkUpkeep(bytes calldata checkData) 
        external 
        view 
        override 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        checkData; // Silence unused parameter warning
        
        uint256 today = block.timestamp - (block.timestamp % 1 days);
        uint256 yesterday = today - 1 days;
        uint256 dayBeforeYesterday = yesterday - 1 days;
        
        // Check if any token needs updating AND has no gaps
        for (uint256 i = 0; i < trackedTokens.length; i++) {
            address token = trackedTokens[i];
            TokenConfig storage config = tokenConfigs[token];
            DailyPrice[] storage prices = priceHistory[token];
            
            // Skip if already updated or not configured
            if (config.priceFeed == address(0) || config.lastUpdateTimestamp >= today) {
                continue;
            }
            
            // Check for gaps: if we have existing data, last entry must be day before yesterday
            if (prices.length > 0) {
                uint256 lastTimestamp = prices[prices.length - 1].timestamp;
                
                // Skip if we already have yesterday's price (shouldn't happen but be safe)
                if (lastTimestamp == yesterday) {
                    continue;
                }
                
                // Check for gap: last entry must be day before yesterday
                if (lastTimestamp != dayBeforeYesterday) {
                    // Gap detected - don't set upkeepNeeded
                    // Owner must backfill before automation can resume
                    continue;
                }
            }
            
            // This token needs update and has no gaps
            upkeepNeeded = true;
            break;
        }
        
        // Return tracked tokens as performData
        performData = abi.encode(trackedTokens);
    }

    /**
     * @notice Chainlink Automation performs the upkeep
     * @dev Called by Chainlink Keeper to update daily prices
     * @param performData Encoded array of tokens to update
     */
    function performUpkeep(bytes calldata performData) external override {
        address[] memory tokens = abi.decode(performData, (address[]));
        
        // Validate that update is still needed
        uint256 today = block.timestamp - (block.timestamp % 1 days);
        bool updateNeeded = false;
        
        for (uint256 i = 0; i < tokens.length; i++) {
            TokenConfig storage config = tokenConfigs[tokens[i]];
            if (config.priceFeed != address(0) && config.lastUpdateTimestamp < today) {
                updateNeeded = true;
                break;
            }
        }
        
        require(updateNeeded, "No update needed");
        
        // Perform the update - call internal update logic
        _updatePrices(tokens, today);
    }
    
    /**
     * @notice Internal function to update prices
     * @param tokens Array of token addresses to update
     * @param today Current day timestamp (UTC midnight) - the start of the today
     */
    function _updatePrices(address[] memory tokens, uint256 today) private {
        // Calculate yesterday's timestamp
        // When called shortly after midnight, we're recording yesterday's closing price
        uint256 yesterday = today - 1 days;
        
        // Time window: only allow updates within first hour after midnight
        // This prevents mid-day calls from overwriting yesterday's close
        uint256 timeIntoDay = block.timestamp - today;
        require(timeIntoDay < 1 hours, "Updates only allowed within 1 hour after midnight UTC");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            TokenConfig storage config = tokenConfigs[token];
            
            if (config.priceFeed == address(0)) continue;
            if (config.lastUpdateTimestamp >= today) continue;

            // Get latest price from Chainlink
            (, int256 price,,,) = AggregatorV3Interface(config.priceFeed).latestRoundData();
            if (price <= 0) continue;

            // Convert to our scale (Chainlink uses 8 decimals)
            uint256 scaledPrice = uint256(price);

            // Store price with yesterday's timestamp (this is yesterday's close)
            DailyPrice[] storage prices = priceHistory[token];
            
            // Gap prevention: ensure we have data for the day before yesterday
            // (except for the very first entry after initialization)
            if (prices.length > 0) {
                uint256 lastTimestamp = prices[prices.length - 1].timestamp;
                
                // Skip if we already have yesterday's price
                if (lastTimestamp == yesterday) {
                    continue;
                }
                
                // Require no gaps: last entry should be day before yesterday
                uint256 dayBeforeYesterday = yesterday - 1 days;
                require(lastTimestamp == dayBeforeYesterday, "Gap detected: missing previous day price");
            }
            
            // Add new entry for yesterday's close
            prices.push(DailyPrice({
                timestamp: yesterday,
                price: scaledPrice
            }));

            config.lastUpdateTimestamp = today;
            // Update precomputed indicators in O(1)
            _updatePrecomputedIndicators(token, prices, yesterday);
            emit PriceAdded(token, yesterday, scaledPrice);
        }
    }

    function _updatePrecomputedIndicators(address token, DailyPrice[] storage prices, uint256 today) private {
        // Require at least two prices to compute return
        if (prices.length < 2) {
            // Initialize running peak
            runningPeak1e8[token] = prices[prices.length - 1].price;
            latestIndicatorsTs[token] = today;
            return;
        }

        uint256 pCurr = prices[prices.length - 1].price; // 1e8
        uint256 pPrev = prices[prices.length - 2].price; // 1e8
        if (pPrev == 0) return;

        // Simple return r = (pCurr - pPrev)/pPrev scaled 1e8; winsorize to ±20%
        int256 diff = int256(pCurr) - int256(pPrev);
        int256 r1e8 = (diff * int256(SCALE)) / int256(pPrev);
        int256 clamp = int256(SCALE) * 20 / 100; // 0.2 * 1e8 = 2e7
        if (r1e8 > clamp) r1e8 = clamp; else if (r1e8 < -clamp) r1e8 = -clamp;

        uint256 rAbs1e8 = uint256(r1e8 >= 0 ? r1e8 : -r1e8);
        uint256 r2_1e16 = (rAbs1e8 * rAbs1e8); // (1e8)^2 = 1e16

        // EWMA update: sigma2_t = λ*sigma2_{t-1} + (1-λ)*r^2
        uint256 prevSigma2 = ewmaSigma2_1e16[token];
        uint256 sigma2 = (prevSigma2 * LAMBDA_BPS + r2_1e16 * (10000 - LAMBDA_BPS)) / 10000;
        ewmaSigma2_1e16[token] = sigma2;

        // vol_daily_1e8 = sqrt(sigma2), vol_ann = vol_daily * sqrt(365)
        uint256 volDaily1e8 = _sqrt1e16_to_1e8(sigma2);
        uint256 volAnn1e8 = (volDaily1e8 * SQRT_365_1e8) / (10 ** 8);
        latestVolAnnualized1e8[token] = volAnn1e8;

        // Drawdown update with running peak
        uint256 peak = runningPeak1e8[token];
        if (peak == 0 || pCurr > peak) peak = pCurr;
        runningPeak1e8[token] = peak;
        uint256 dd1e8 = peak > 0 ? ((peak - pCurr) * (10 ** 8)) / peak : 0;
        latestDrawdown1e8[token] = dd1e8;
        latestIndicatorsTs[token] = today;
    }

    function latestEwmaVolAnnualized(address token) external view returns (uint256 value1e8, uint256 ts) {
        return (latestVolAnnualized1e8[token], latestIndicatorsTs[token]);
    }

    function latestDrawdown(address token) external view returns (uint256 value1e8, uint256 ts) {
        return (latestDrawdown1e8[token], latestIndicatorsTs[token]);
    }

    function _sqrt1e16_to_1e8(uint256 x) internal pure returns (uint256) {
        // sqrt for 1e16-scaled value, result 1e8
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @notice Owner-only backfill to recompute EWMA volatility and drawdown from full history
     * @dev Recomputes and updates: ewmaSigma2_1e16, latestVolAnnualized1e8, runningPeak1e8,
     *      latestDrawdown1e8, latestIndicatorsTs for the given token.
     */
    function recomputeIndicators(address token) external onlyOwner {
        DailyPrice[] storage prices = priceHistory[token];
        require(prices.length > 0, "No price history");

        uint256 sigma2 = 0; // 1e16 scale
        uint256 peak = 0;   // 1e8 price
        uint256 lastVolAnn1e8 = 0;
        uint256 lastDd1e8 = 0;
        uint256 lastTs = 0;

        for (uint256 i = 0; i < prices.length; i++) {
            uint256 pCurr = prices[i].price; // 1e8
            lastTs = prices[i].timestamp;

            if (i == 0) {
                // Initialize running peak at first price
                peak = pCurr;
                // Drawdown 0, vol 0 on first observation
                lastVolAnn1e8 = 0;
                lastDd1e8 = 0;
                continue;
            }

            uint256 pPrev = prices[i - 1].price; // 1e8
            if (pPrev > 0) {
                // Simple return r = (pCurr - pPrev)/pPrev scaled 1e8, winsorize at ±20%
                int256 diff = int256(pCurr) - int256(pPrev);
                int256 r1e8 = (diff * int256(SCALE)) / int256(pPrev);
                int256 clamp = int256(SCALE) * 20 / 100; // 0.2 * 1e8 = 2e7
                if (r1e8 > clamp) r1e8 = clamp; else if (r1e8 < -clamp) r1e8 = -clamp;

                uint256 rAbs1e8 = uint256(r1e8 >= 0 ? r1e8 : -r1e8);
                uint256 r2_1e16 = (rAbs1e8 * rAbs1e8); // 1e16

                // EWMA update
                sigma2 = (sigma2 * LAMBDA_BPS + r2_1e16 * (10000 - LAMBDA_BPS)) / 10000;
                uint256 volDaily1e8 = _sqrt1e16_to_1e8(sigma2);
                lastVolAnn1e8 = (volDaily1e8 * SQRT_365_1e8) / (10 ** 8);
            }

            // Drawdown with running peak
            if (peak == 0 || pCurr > peak) peak = pCurr;
            lastDd1e8 = peak > 0 ? ((peak - pCurr) * (10 ** 8)) / peak : 0;
        }

        // Persist recomputed values
        ewmaSigma2_1e16[token] = sigma2;
        latestVolAnnualized1e8[token] = lastVolAnn1e8;
        runningPeak1e8[token] = peak;
        latestDrawdown1e8[token] = lastDd1e8;
        latestIndicatorsTs[token] = lastTs;
    }

    /**
     * @notice Manually backfill missing daily prices (owner only)
     * @dev Use this to recover from keeper failures or fill gaps
     * @param token Token address to backfill
     * @param timestamps Array of UTC midnight timestamps to fill (start of the day for the daily closing price)
     * @param prices Array of closing prices (scaled by 1e8)
     */
    function backfillDailyPrices(
        address token,
        uint256[] calldata timestamps,
        uint256[] calldata prices
    ) external onlyOwner {
        require(timestamps.length == prices.length, "Length mismatch");
        require(timestamps.length > 0, "Empty arrays");
        
        TokenConfig storage config = tokenConfigs[token];
        require(config.priceFeed != address(0), "Token not configured");
        
        DailyPrice[] storage priceHistory_ = priceHistory[token];
        uint256 lastTimestamp = priceHistory_.length > 0 ? priceHistory_[priceHistory_.length - 1].timestamp : 0;
        
        for (uint256 i = 0; i < timestamps.length; i++) {
            uint256 ts = timestamps[i];
            uint256 price = prices[i];
            
            // Validate timestamp is UTC midnight
            require(ts % 1 days == 0, "Timestamp must be UTC midnight");
            
            // Validate price is positive
            require(price > 0, "Invalid price");
            
            // Ensure chronological order and no duplicates
            require(ts > lastTimestamp, "Timestamps must be chronological and after existing data");
            
            // Validate no gaps (each entry should be exactly 1 day after previous)
            if (i > 0) {
                require(ts == timestamps[i - 1] + 1 days, "Gap in backfill timestamps");
            } else if (priceHistory_.length > 0) {
                require(ts == lastTimestamp + 1 days, "Gap between existing data and backfill");
            }
            
            // Add price entry
            priceHistory_.push(DailyPrice({
                timestamp: ts,
                price: price
            }));
            
            emit PriceAdded(token, ts, price);
            lastTimestamp = ts;
        }
        
        // Update lastUpdateTimestamp to prevent immediate automation overwrite
        // Set it to the day after the last backfilled entry
        config.lastUpdateTimestamp = lastTimestamp + 1 days;
    }

    /**
     * @notice Get list of tracked tokens for automation
     * @return Array of tracked token addresses
     */
    function getTrackedTokens() external view returns (address[] memory) {
        return trackedTokens;
    }

    /**
     * @notice Required by UUPSUpgradeable - only owner can upgrade
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
