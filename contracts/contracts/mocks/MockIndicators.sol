// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockIndicators {
    struct Metrics { uint256 vol1e8; uint256 dd1e8; uint256 ts; }
    mapping(address => Metrics) public m;

    function set(address token, uint256 vol1e8, uint256 dd1e8, uint256 ts) external {
        m[token] = Metrics({ vol1e8: vol1e8, dd1e8: dd1e8, ts: ts });
    }

    function latestEwmaVolAnnualized(address token) external view returns (uint256 value1e8, uint256 ts) {
        Metrics memory x = m[token];
        return (x.vol1e8, x.ts);
    }

    function latestDrawdown(address token) external view returns (uint256 value1e8, uint256 ts) {
        Metrics memory x = m[token];
        return (x.dd1e8, x.ts);
    }
}


