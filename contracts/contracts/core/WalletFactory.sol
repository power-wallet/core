// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./PowerWallet.sol";
import "./StrategyRegistry.sol";

contract WalletFactory is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    StrategyRegistry public registry;

    // user => list of wallets
    mapping(address => address[]) public userWallets;

    event WalletCreated(address indexed user, address wallet, bytes32 indexed strategyId, address strategyImpl, address strategyInstance);
    address public swapRouter;

    function initialize(address initialOwner, StrategyRegistry _registry, address _swapRouter) external initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
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

        // Clone a fresh instance of the strategy and initialize it
        address strategyInstance = Clones.clone(strategyImpl);
        if (strategyInitData.length > 0) {
            (bool ok,) = strategyInstance.call(strategyInitData);
            require(ok, "strategy init failed");
        }
        // Transfer strategy ownership to the wallet owner (msg.sender)
        (bool ok2,) = strategyInstance.call(abi.encodeWithSignature("transferOwnership(address)", msg.sender));
        require(ok2, "transferOwnership failed");

        // Deploy wallet owned by factory so it can initialize, then transfer to user
        PowerWallet wallet = new PowerWallet(address(this), strategyInstance);
        wallet.initialize(
            stableAsset,
            riskAssets,
            priceFeeds,
            poolFees,
            swapRouter
        );

        wallet.transferOwnership(msg.sender);

        walletAddr = address(wallet);
        userWallets[msg.sender].push(walletAddr);
        emit WalletCreated(msg.sender, walletAddr, strategyId, strategyImpl, strategyInstance);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}


