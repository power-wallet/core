// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/TechnicalIndicators.sol";

/**
 * @title MockSMA
 * @notice Minimal mock that serves SMA and latest price windows compatible with TechnicalIndicators ABI
 */
contract MockSMA {
    struct PricePoint { uint256 ts; uint256 p; }
    mapping(address => PricePoint[]) internal series;

    function setSeries(address token, uint256[] calldata timestamps, uint256[] calldata prices) external {
        require(timestamps.length == prices.length && prices.length > 0, "len");
        delete series[token];
        for (uint256 i = 0; i < prices.length; i++) {
            series[token].push(PricePoint({ ts: timestamps[i], p: prices[i] }));
        }
    }

    function calculateSMA(address token, uint256 period) external view returns (uint256) {
        PricePoint[] storage s = series[token];
        require(s.length >= period && period > 0, "data");
        uint256 sum = 0;
        for (uint256 i = s.length - period; i < s.length; i++) sum += s[i].p;
        return sum / period; // 1e8 scale assumed by caller
    }

    function getLatestPrices(address token, uint256 count)
        external
        view
        returns (TechnicalIndicators.DailyPrice[] memory)
    {
        PricePoint[] storage s = series[token];
        require(count > 0 && count <= s.length, "count");
        TechnicalIndicators.DailyPrice[] memory out = new TechnicalIndicators.DailyPrice[](count);
        for (uint256 i = 0; i < count; i++) {
            PricePoint storage pp = s[s.length - count + i];
            out[i] = TechnicalIndicators.DailyPrice({ timestamp: pp.ts, price: pp.p });
        }
        return out;
    }
}


