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
    // Minimal ownable (initializer-style for clones)
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }
    function owner() public view returns (address) {
        return _owner;
    }
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
    address public riskAsset;
    address public stableAsset;
    uint256 public dcaAmountStable; // in stable decimals
    uint256 public frequency; // seconds
    uint256 public lastTimestamp;
    address public authorizedWallet;
    string private _description;
    string private _id;
    string private _name;

    event Initialized(address risk, address stable, uint256 amount, uint256 frequency);
    event Executed(uint256 when, uint256 amountStable);

    // interface 'function initialize(address,address,uint256,uint256,string)'
    function initialize(address _risk, address _stable, uint256 _amountStable, uint256 _frequency, string calldata desc) external {
        require(_owner == address(0), "inited");
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
        
        require(_risk != address(0) && _stable != address(0), "addr");
        require(_amountStable > 0 && _frequency > 0, "params");
        
        riskAsset = _risk;
        stableAsset = _stable;
        dcaAmountStable = _amountStable;
        frequency = _frequency;
        lastTimestamp = 0;
        _description = desc;
        _id = "simple-btc-dca-v1";
        _name = "Simple BTC DCA";
        
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

    // V2 hook receiving actions; here we only update cadence gate
    function onRebalanceExecuted(SwapAction[] calldata /*actions*/) external {
        require(msg.sender == authorizedWallet, "unauthorized");
        
        lastTimestamp = block.timestamp;
        emit Executed(lastTimestamp, dcaAmountStable);
    }

    function description() external view override returns (string memory) {
        return _description;
    }

    function id() external view override returns (string memory) {
        return _id;
    }

    function name() external view override returns (string memory) {
        return _name;
    }

    // Owner setters
    function setDcaAmountStable(uint256 newAmount) external onlyOwner {
        require(newAmount > 0, "amount");
        dcaAmountStable = newAmount;
    }

    function setFrequency(uint256 newFrequency) external onlyOwner {
        require(newFrequency > 0, "freq");
        frequency = newFrequency;
    }

    function setAuthorizedWallet(address wallet_) external onlyOwner {
        authorizedWallet = wallet_;
    }
}


