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
    address public uniswapV3Factory;

    function initialize(address initialOwner, StrategyRegistry _registry, address _swapRouter, address _uniswapV3Factory) external initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        registry = _registry;
        swapRouter = _swapRouter;
        uniswapV3Factory = _uniswapV3Factory;
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

        // Deploy wallet owned by factory so it can initialize, then transfer to user
        PowerWallet wallet = new PowerWallet(address(this));
        wallet.initialize(
            stableAsset,
            riskAssets,
            priceFeeds,
            poolFees,
            swapRouter,
            uniswapV3Factory,
            strategyInstance,
            strategyInitData
        );

        // Transfer strategy ownership to the wallet owner (msg.sender)
        (bool ok2,) = strategyInstance.call(abi.encodeWithSignature("transferOwnership(address)", msg.sender));
        require(ok2, "transferOwnership failed");

        // Transfer wallet ownership after full initialization
        wallet.transferOwnership(msg.sender);

        walletAddr = address(wallet);
        userWallets[msg.sender].push(walletAddr);
        emit WalletCreated(msg.sender, walletAddr, strategyId, strategyImpl, strategyInstance);
    }
    
    function deleteWallet(address walletAddr) external {
        // Only allow if sender owns the referenced wallet
        require(PowerWallet(walletAddr).owner() == msg.sender, "not owner");
        // Optional safety: require wallet closed or balances zero
        // If the new version has isClosed, check it; else skip.
        // Try/catch to support both versions
        bool ok = true;
        try PowerWallet(walletAddr).isClosed() returns (bool closed) {
            require(closed, "wallet not closed");
        } catch { ok = true; }
        // ok; // silence unused

        address[] storage list = userWallets[msg.sender];
        uint256 n = list.length;
        for (uint256 i = 0; i < n; i++) {
            if (list[i] == walletAddr) {
                if (i != n - 1) {
                    list[i] = list[n - 1];
                }
                list.pop();
                return;
            }
        }
        revert("wallet not found");
    }

    // Post-upgrade admin setter to wire factory address for new wallet validations
    function setUniswapV3Factory(address _factory) external onlyOwner {
        require(_factory != address(0), "zero");
        uniswapV3Factory = _factory;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}


