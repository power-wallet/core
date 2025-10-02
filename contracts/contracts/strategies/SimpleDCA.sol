// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IStrategy.sol";

/**
 * @title SimpleDCA
 * @notice A simple DCA strategy that buys a fixed amount of risk asset at a fixed frequency using stable balance.
 * @dev This strategy expects to be called via IStrategy.shouldRebalance by a PowerWallet.
 * Initialization data (abi.encode) expected as: (address riskAsset, address stableAsset, uint256 dcaAmountStable, uint256 frequencySeconds)
 */
contract SimpleDCA is IStrategy {
    address public riskAsset;
    address public stableAsset;
    uint256 public dcaAmountStable; // in stable decimals
    uint256 public frequency; // seconds
    uint256 public lastTimestamp;
    string private _description;

    event Initialized(address risk, address stable, uint256 amount, uint256 frequency);
    event Executed(uint256 when, uint256 amountStable);

    function initialize(address _risk, address _stable, uint256 _amountStable, uint256 _frequency, string calldata desc) external {
        require(riskAsset == address(0), "inited");
        require(_risk != address(0) && _stable != address(0), "addr");
        require(_amountStable > 0 && _frequency > 0, "params");
        riskAsset = _risk;
        stableAsset = _stable;
        dcaAmountStable = _amountStable;
        frequency = _frequency;
        lastTimestamp = 0;
        _description = desc;
        emit Initialized(_risk, _stable, _amountStable, _frequency);
    }

    function shouldRebalance(
        address stable,
        address[] calldata risk,
        uint256 stableBalance,
        uint256[] calldata /* riskBalances */
    ) external view override returns (bool needsRebalance, SwapAction[] memory actions) {
        // Ensure configured assets match
        if (stable != stableAsset) return (false, actions);
        if (risk.length == 0 || risk[0] != riskAsset) return (false, actions);
        // Frequency gate
        if (block.timestamp < lastTimestamp + frequency) return (false, actions);
        if (stableBalance < dcaAmountStable) return (false, actions);

        actions = new SwapAction[](1);
        actions[0] = SwapAction({ tokenIn: stableAsset, tokenOut: riskAsset, amountIn: dcaAmountStable });
        return (true, actions);
    }

    function onRebalanceExecuted() external {
        lastTimestamp = block.timestamp;
        emit Executed(lastTimestamp, dcaAmountStable);
    }

    function description() external view override returns (string memory) {
        return _description;
    }
}


