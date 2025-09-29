// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract TechnicalIndicators is Initializable, OwnableUpgradeable, UUPSUpgradeable {
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

    function updateDailyPrices(address[] calldata tokens) external {
        uint256 today = block.timestamp - (block.timestamp % 1 days);

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            TokenConfig storage config = tokenConfigs[token];
            require(config.priceFeed != address(0), "Token not configured");

            // Check if we already updated today
            if (config.lastUpdateTimestamp >= today) {
                continue;
            }

            // Get latest price from Chainlink
            (, int256 price,,,) = AggregatorV3Interface(config.priceFeed).latestRoundData();
            require(price > 0, "Invalid price");

            // Convert to our scale (Chainlink uses 8 decimals)
            uint256 scaledPrice = uint256(price);

            // Update or add price
            DailyPrice[] storage prices = priceHistory[token];
            if (prices.length > 0 && prices[prices.length - 1].timestamp == today) {
                prices[prices.length - 1].price = scaledPrice;
            } else {
                prices.push(DailyPrice({
                    timestamp: today,
                    price: scaledPrice
                }));
            }

            config.lastUpdateTimestamp = today;
            emit PriceAdded(token, today, scaledPrice);
        }
    }

    function calculateSMA(address token) public view returns (uint256) {
        DailyPrice[] storage prices = priceHistory[token];
        require(prices.length >= SMA_PERIOD, "Insufficient data");

        uint256 sum;
        for (uint256 i = prices.length - SMA_PERIOD; i < prices.length; i++) {
            sum += prices[i].price;
        }

        return sum / SMA_PERIOD;
    }

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

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
