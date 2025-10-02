// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PowerWallet.sol";
import "./StrategyRegistry.sol";

contract WalletFactory is Ownable {
    StrategyRegistry public immutable registry;

    // user => list of wallets
    mapping(address => address[]) public userWallets;

    event WalletCreated(address indexed user, address wallet, bytes32 indexed strategyId, address strategyImpl);
    address public immutable swapRouter;

    constructor(address initialOwner, StrategyRegistry _registry, address _swapRouter) Ownable(initialOwner) {
        registry = _registry;
        swapRouter = _swapRouter;
    }

    function getUserWallets(address user) external view returns (address[] memory) {
        return userWallets[user];
    }

    function createWallet(
        bytes32 strategyId,
        bytes calldata strategyInitData,
        address stableAsset,
        address[] calldata riskAssets,
        address[] calldata priceFeeds,
        uint24[] calldata poolFees
    ) external returns (address walletAddr) {
        address strategyImpl = registry.strategies(strategyId);
        require(strategyImpl != address(0), "strategy not found");
        require(riskAssets.length == priceFeeds.length, "len mismatch");
        require(riskAssets.length == poolFees.length, "len mismatch");

        PowerWallet wallet = new PowerWallet(msg.sender, strategyImpl);
        wallet.initialize(
            stableAsset,
            riskAssets,
            priceFeeds,
            poolFees,
            swapRouter,
            strategyInitData
        );

        wallet.transferOwnership(msg.sender);

        walletAddr = address(wallet);
        userWallets[msg.sender].push(walletAddr);
        emit WalletCreated(msg.sender, walletAddr, strategyId, strategyImpl);
    }
}


