// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStrategy {
    struct SwapAction {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
    }

    function description() external view returns (string memory);
    function id() external view returns (string memory);
    function name() external view returns (string memory);

    function shouldRebalance(
        address stableAsset,
        address[] calldata riskAssets,
        uint256 stableBalance,
        uint256[] calldata riskBalances
    ) external view returns (bool needsRebalance, SwapAction[] memory actions);
}

interface IStrategyExecutionHook {
    function onRebalanceExecuted() external;
}


