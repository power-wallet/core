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
        uint256 timestamp;  // UTC midnight
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
    uint256 public constant ETHBTC_RSI_PERIOD = 5;    // RSI period for ETH/BTC ratio
    uint256 public constant SMA_PERIOD = 200;         // SMA period for regime filter

    // Events
    event PriceAdded(address token, uint256 timestamp, uint256 price);
    event TokenConfigured(address token, address priceFeed);

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
     * @return SMA value scaled by SCALE
     */
    function calculateSMA(address token) public view returns (uint256) {
        DailyPrice[] storage prices = priceHistory[token];
        require(prices.length >= SMA_PERIOD, "Insufficient data");

        uint256 sum;
        for (uint256 i = prices.length - SMA_PERIOD; i < prices.length; i++) {
            sum += prices[i].price;
        }

        return sum / SMA_PERIOD;
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
     * @return RSI value scaled by SCALE (0-100 * SCALE)
     */
    function calculateEthBtcRSI(address ethToken, address btcToken) public view returns (uint256) {
        DailyPrice[] storage ethPrices = priceHistory[ethToken];
        DailyPrice[] storage btcPrices = priceHistory[btcToken];
        
        require(ethPrices.length == btcPrices.length, "Price history length mismatch");
        require(ethPrices.length >= ETHBTC_RSI_PERIOD + 1, "Insufficient data");

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
        for (uint256 i = ratioPrices.length - ETHBTC_RSI_PERIOD - 1; i < ratioPrices.length - 1; i++) {
            if (ratioPrices[i + 1] > ratioPrices[i]) {
                avgGain += ratioPrices[i + 1] - ratioPrices[i];
            } else {
                avgLoss += ratioPrices[i] - ratioPrices[i + 1];
            }
        }

        avgGain = (avgGain * SCALE) / ETHBTC_RSI_PERIOD;
        avgLoss = (avgLoss * SCALE) / ETHBTC_RSI_PERIOD;

        // Calculate RSI
        if (avgLoss == 0) {
            return 100 * SCALE;
        }

        uint256 rs = (avgGain * SCALE) / avgLoss;
        return (100 * SCALE) - ((100 * SCALE * SCALE) / (SCALE + rs));
    }

    /**
     * @notice Gets historical price data for a token
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
     * @param today Current day timestamp (UTC midnight)
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
            emit PriceAdded(token, yesterday, scaledPrice);
        }
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
