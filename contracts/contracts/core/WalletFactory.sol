// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./PowerWallet.sol";
import "./StrategyRegistry.sol";

contract WalletFactory is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    event WalletCreated(address indexed user, address wallet, bytes32 indexed strategyId, address strategyImpl, address strategyInstance);
    
    StrategyRegistry public registry;

    // user => list of wallets
    mapping(address => address[]) public userWallets;
    address public swapRouter;
    address public uniswapV3Factory;

    // ---------------------------------------------
    // Track unique users who have created at least one wallet
    address[] private users;
    mapping(address => bool) public hasCreatedWallet;

    // Storage gap for future variable additions without shifting layout
    uint256[50] private __gap;

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

    function getUsers() external view returns (address[] memory) {
        return users;
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

        // Clone a fresh instance of the strategy and initialize it (factory is owner during setup)
        address strategyInstance = Clones.clone(strategyImpl);

        if (strategyInitData.length > 0) {
            (bool ok,) = strategyInstance.call(strategyInitData);
            require(ok, "strategy init failed");
        }

        // Deploy wallet owned by factory so it can initialize
        PowerWallet wallet = new PowerWallet(address(this));
        wallet.initialize(
            stableAsset,
            riskAssets,
            priceFeeds,
            poolFees,
            swapRouter,
            uniswapV3Factory,
            strategyInstance
        );

        // Bind the wallet as the authorized caller on the strategy
        (bool okAuth,) = strategyInstance.call(abi.encodeWithSignature("setAuthorizedWallet(address)", address(wallet)));
        require(okAuth, "setAuthorizedWallet failed");

        // Transfer strategy ownership to the user AFTER wiring authorized wallet
        (bool ok2,) = strategyInstance.call(abi.encodeWithSignature("transferOwnership(address)", msg.sender));
        require(ok2, "transferOwnership failed");

        // Transfer wallet ownership after full initialization
        wallet.transferOwnership(msg.sender);

        walletAddr = address(wallet);
        userWallets[msg.sender].push(walletAddr);
        if (!hasCreatedWallet[msg.sender]) {
            hasCreatedWallet[msg.sender] = true;
            users.push(msg.sender);
        }
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

    // Owner-only administrative removal without closure checks
    function adminDeleteWallet(address user, address walletAddr) external onlyOwner {
        address[] storage list = userWallets[user];
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


