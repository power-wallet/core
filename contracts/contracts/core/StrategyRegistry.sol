// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract StrategyRegistry is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // strategyId => implementation contract
    mapping(bytes32 => address) public strategies;
    bytes32[] public strategyIds;

    event StrategyRegistered(bytes32 indexed id, address implementation);
    event StrategyRemoved(bytes32 indexed id);

    function initialize(address initialOwner) external initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
    }

    function registerStrategy(bytes32 id, address implementation) external onlyOwner {
        require(id != bytes32(0), "invalid id");
        require(implementation != address(0), "invalid impl");
        require(strategies[id] == address(0), "exists");
        strategies[id] = implementation;
        strategyIds.push(id);
        emit StrategyRegistered(id, implementation);
    }

    function removeStrategy(bytes32 id) external onlyOwner {
        require(strategies[id] != address(0), "not found");
        delete strategies[id];
        // keep id in array for history; clients should check mapping presence
        emit StrategyRemoved(id);
    }

    function getStrategy(bytes32 id) external view returns (address) {
        return strategies[id];
    }

    function listStrategies() external view returns (bytes32[] memory) {
        return strategyIds;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}


