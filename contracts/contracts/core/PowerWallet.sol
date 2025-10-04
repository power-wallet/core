// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IUniswapV3Like.sol";

contract PowerWallet is Ownable, AutomationCompatibleInterface, ReentrancyGuard {
    // Assets
    address public stableAsset; // e.g., USDC
    address[] public riskAssets; // e.g., cbBTC, WETH

    // Chainlink price feeds per asset
    mapping(address => address) public priceFeeds; // token => feed

    // Uniswap V3 router and fee per risk asset (risk <-> stable)
    address public swapRouter; // e.g., SwapRouter02
    mapping(address => uint24) public poolFees; // risk asset of the UniswapV3 pool => fee (100/500/3000/10000)
    // Uniswap V3 factory used to validate pools
    address public uniswapV3Factory;

    // Strategy implementation
    address public strategy;

    // packed variables (uint256)
    bool public automationPaused;
    bool public isClosed;
    uint64 public createdAt;
    uint16 public slippageBps; // e.g., 100 = 1%

    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event SwapExecuted(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 ts, uint256 balInAfter, uint256 balOutAfter);
    event AutomationPaused(address indexed by);
    event AutomationUnpaused(address indexed by);
    event StrategyUpdated(address indexed by, address indexed newStrategy);
    event FeesUpdated(address indexed riskAsset, uint24 oldFee, uint24 newFee);
    event WalletClosed(address indexed by);
    event Initialized(
        address indexed owner,
        address stable,
        address[] riskAssets,
        address[] priceFeeds,
        uint24[] poolFees,
        address strategy
    );

    struct SwapRecord {
        uint256 timestamp;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 balanceInAfter;
        uint256 balanceOutAfter;
    }

    SwapRecord[] public swaps;

    struct DepositRecord {
        uint256 timestamp;
        address user;
        uint256 amount;
        uint256 balanceAfter;
    }

    struct WithdrawRecord {
        uint256 timestamp;
        address user;
        address asset;
        uint256 amount;
        uint256 balanceAfter;
    }

    DepositRecord[] public deposits;
    WithdrawRecord[] public withdrawals;

    constructor(address initialOwner) Ownable(initialOwner) {
        createdAt = uint64(block.timestamp);
        slippageBps = 100; // default 1%
    }

   
    function initialize(
        address _stableAsset,
        address[] calldata _riskAssets,
        address[] calldata _priceFeeds,
        uint24[] calldata _poolFees,
        address _swapRouter,
        address _uniswapV3Factory,
        address _strategy
    ) external onlyOwner {
        require(stableAsset == address(0), "inited");
        stableAsset = _stableAsset;
        riskAssets = _riskAssets;
        require(_riskAssets.length == _priceFeeds.length, "len");
        require(_riskAssets.length == _poolFees.length, "len");
        for (uint256 i = 0; i < _riskAssets.length; i++) {
            priceFeeds[_riskAssets[i]] = _priceFeeds[i];
            poolFees[_riskAssets[i]] = _poolFees[i];
        }
        require(_swapRouter != address(0), "router");
        swapRouter = _swapRouter;
        require(_uniswapV3Factory != address(0), "factory");
        uniswapV3Factory = _uniswapV3Factory;
        require(_strategy != address(0), "strategy");
        strategy = _strategy;
        emit Initialized(owner(), _stableAsset, _riskAssets, _priceFeeds, _poolFees, _strategy);
    }

    function pauseAutomation() external onlyOwner {
        automationPaused = true;
        emit AutomationPaused(msg.sender);
    }

    function unpauseAutomation() external onlyOwner {
        automationPaused = false;
        emit AutomationUnpaused(msg.sender);
    }

    function setStrategy(address newStrategy, bytes calldata initData) external onlyOwner {
        require(newStrategy != address(0), "zero strategy");
        strategy = newStrategy;
        if (initData.length > 0) {
            (bool ok,) = strategy.call(initData);
            require(ok, "strategy init failed");
        }
        emit StrategyUpdated(msg.sender, newStrategy);
    }

    function setSlippageBps(uint16 newSlippageBps) external onlyOwner {
        require(newSlippageBps <= 5000, "slippage too high");
        slippageBps = newSlippageBps;
    }

    // Deposits/withdraws are in stable asset
    function deposit(uint256 amount) external nonReentrant {
        require(IERC20(stableAsset).transferFrom(msg.sender, address(this), amount), "transferFrom");
        emit Deposit(msg.sender, amount);
        uint256 balAfter = IERC20(stableAsset).balanceOf(address(this));
        deposits.push(DepositRecord({ timestamp: block.timestamp, user: msg.sender, amount: amount, balanceAfter: balAfter }));
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        withdrawAsset(stableAsset, amount);
    }

    function withdrawAsset(address asset, uint256 amount) public onlyOwner nonReentrant {
        require(asset == stableAsset || _isRiskAsset(asset), "unsupported asset");
        require(IERC20(asset).transfer(msg.sender, amount), "transfer");
        emit Withdraw(msg.sender, amount);
        uint256 balAfter = IERC20(asset).balanceOf(address(this));
        withdrawals.push(WithdrawRecord({ timestamp: block.timestamp, user: msg.sender, asset: asset, amount: amount, balanceAfter: balAfter }));
    }

    function getBalances() public view returns (uint256 stableBal, uint256[] memory riskBals) {
        stableBal = IERC20(stableAsset).balanceOf(address(this));
        riskBals = new uint256[](riskAssets.length);
        for (uint256 i = 0; i < riskAssets.length; i++) {
            riskBals[i] = IERC20(riskAssets[i]).balanceOf(address(this));
        }
    }

    function _latestPrice(address token) internal view returns (uint256 price, uint8 decimals) {
        address feed = priceFeeds[token];
        require(feed != address(0), "no feed");
        (, int256 p,,,) = AggregatorV3Interface(feed).latestRoundData();
        require(p > 0, "bad price");
        price = uint256(p);
        decimals = AggregatorV3Interface(feed).decimals();
    }

    // Compute minimum acceptable output based on Chainlink prices and slippageBps
    function _computeAmountOutMin(address tokenIn, address tokenOut, uint256 amountIn) internal view returns (uint256) {
        // Case 1: stable -> risk (assume stable is USD-like)
        if (tokenIn == stableAsset) {
            (uint256 riskPrice, uint8 priceDec) = _latestPrice(tokenOut);
            uint8 riskDec = IERC20Metadata(tokenOut).decimals();
            uint8 stableDec = IERC20Metadata(stableAsset).decimals();
            // estimatedOut = amountIn * 10^(riskDec + priceDec) / (riskPrice * 10^stableDec)
            uint256 scale = 10 ** (uint256(riskDec) + uint256(priceDec));
            uint256 tmp = (amountIn * scale) / riskPrice;
            uint256 estimatedOut = tmp / (10 ** uint256(stableDec));
            return (estimatedOut * (10000 - slippageBps)) / 10000;
        }
        // Case 2: risk -> stable
        if (tokenOut == stableAsset) {
            (uint256 riskPrice, uint8 priceDec) = _latestPrice(tokenIn);
            uint8 riskDec = IERC20Metadata(tokenIn).decimals();
            uint8 stableDec = IERC20Metadata(stableAsset).decimals();
            // estimatedOut (stableDec) = amountIn * riskPrice * 10^stableDec / 10^(riskDec + priceDec)
            uint256 num = amountIn * riskPrice;
            uint256 sum = uint256(riskDec) + uint256(priceDec);
            uint256 estimatedOut;
            if (sum >= uint256(stableDec)) {
                uint256 divPow = sum - uint256(stableDec);
                estimatedOut = num / (10 ** divPow);
            } else {
                uint256 mulPow = uint256(stableDec) - sum;
                estimatedOut = num * (10 ** mulPow);
            }
            return (estimatedOut * (10000 - slippageBps)) / 10000;
        }
        // Unknown pair orientation: fallback to zero minOut (best-effort)
        return 0;
    }

    function getPortfolioValueUSD() public view returns (uint256 usd6) {
        (uint256 stableBal, uint256[] memory riskBals) = getBalances();
        // Scale stable to 6 decimals (USDC-like)
        uint8 stableDec = IERC20Metadata(stableAsset).decimals();
        if (stableDec >= 6) {
            usd6 += stableBal / (10 ** (stableDec - 6));
        } else {
            usd6 += stableBal * (10 ** (6 - stableDec));
        }
        for (uint256 i = 0; i < riskAssets.length; i++) {
            address token = riskAssets[i];
            (uint256 price, uint8 priceDec) = _latestPrice(token); // priceDec typically 8
            uint8 tokenDec = IERC20Metadata(token).decimals();
            // Convert token amount * price to 6 decimals: bal * price * 10^6 / 10^(tokenDec + priceDec)
            uint256 numerator = riskBals[i] * price;
            uint256 denomPow = tokenDec + priceDec;
            uint256 value6;
            if (denomPow >= 6) {
                value6 = numerator / (10 ** (denomPow - 6));
            } else {
                value6 = numerator * (10 ** (6 - denomPow));
            }
            usd6 += value6;
        }
    }

    // Returns the USD value (6 decimals) of a specific risk asset held by this wallet
    function getAeetValueUSD(address token) public view returns (uint256 usd6) {
        // Require token configured with a price feed (used as proxy that it is a supported risk asset)
        require(priceFeeds[token] != address(0), "asset not configured");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) return 0;
        (uint256 price, uint8 priceDec) = _latestPrice(token);
        uint8 tokenDec = IERC20Metadata(token).decimals();
        uint256 numerator = bal * price;
        uint256 denomPow = tokenDec + priceDec;
        if (denomPow >= 6) {
            usd6 = numerator / (10 ** (denomPow - 6));
        } else {
            usd6 = numerator * (10 ** (6 - denomPow));
        }
    }

    // Automation
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        if (automationPaused) {
            return (false, bytes(""));
        }
        (uint256 stableBal, uint256[] memory riskBals) = getBalances();
        (bool needed, IStrategy.SwapAction[] memory actions) = IStrategy(strategy).shouldRebalance(
            stableAsset,
            riskAssets,
            stableBal,
            riskBals
        );
        upkeepNeeded = needed;
        performData = abi.encode(actions);
    }

    function performUpkeep(bytes calldata performData) external override nonReentrant {
        require(!automationPaused, "automation paused");
        // Defensive re-check: compute current need and actions, ignore provided performData
        performData; // silence unused
        (uint256 stableBal, uint256[] memory riskBals) = getBalances();
        (bool needed, IStrategy.SwapAction[] memory actions) = IStrategy(strategy).shouldRebalance(
            stableAsset,
            riskAssets,
            stableBal,
            riskBals
        );
        require(needed && actions.length > 0, "no upkeep needed");

        for (uint256 i = 0; i < actions.length; i++) {
            // Validate action tokens belong to configured set
            bool tokenInIsStable = actions[i].tokenIn == stableAsset;
            bool tokenOutIsStable = actions[i].tokenOut == stableAsset;
            require(tokenInIsStable || tokenOutIsStable, "pair must include stable");
            bool tokenInIsRisk = _isRiskAsset(actions[i].tokenIn);
            bool tokenOutIsRisk = _isRiskAsset(actions[i].tokenOut);
            require(tokenInIsRisk || tokenOutIsRisk, "unknown asset");
            _executeSwap(actions[i]);
        }
        // optional hook
        (bool ok,) = strategy.call(abi.encodeWithSelector(IStrategyExecutionHook.onRebalanceExecuted.selector));
        ok; // ignore failure
    }

    // Close wallet: sweep funds to owner and disable operations permanently
    function closeWallet() external onlyOwner nonReentrant {
        automationPaused = true;
        // Sweep risk assets
        for (uint256 i = 0; i < riskAssets.length; i++) {
            IERC20 token = IERC20(riskAssets[i]);
            uint256 bal = token.balanceOf(address(this));
            if (bal > 0) {
                token.transfer(msg.sender, bal);
            }
        }
        // Sweep stable
        uint256 stableBal = IERC20(stableAsset).balanceOf(address(this));
        if (stableBal > 0) {
            IERC20(stableAsset).transfer(msg.sender, stableBal);
        }
        isClosed = true;
        emit WalletClosed(msg.sender);
    }

    // Update pool fee for a configured risk asset after validating pool exists
    function setFees(address[] calldata risks, uint24[] calldata fees) external onlyOwner {
        require(risks.length == fees.length && risks.length > 0, "len");
        IUniswapV3FactoryLike factory = IUniswapV3FactoryLike(uniswapV3Factory);
        for (uint256 i = 0; i < risks.length; i++) {
            address risk = risks[i];
            uint24 fee = fees[i];
            require(_isRiskAsset(risk), "unknown risk");
            address pool = factory.getPool(stableAsset, risk, fee);
            require(pool != address(0), "pool missing");
            uint24 old = poolFees[risk];
            poolFees[risk] = fee;
            emit FeesUpdated(risk, old, fee);
        }
    }

    function _isRiskAsset(address token) internal view returns (bool) {
        for (uint256 i = 0; i < riskAssets.length; i++) {
            if (riskAssets[i] == token) return true;
        }
        return false;
    }

    function _executeSwap(IStrategy.SwapAction memory action) internal {
        require(action.amountIn > 0, "amountIn");
        require(swapRouter != address(0), "no router");
        
        // Approve router to pull tokens for swap
        // IERC20(action.tokenIn).approve(swapRouter, action.amountIn);
        
        // Ensure router allowance for tokenIn using safe pattern
        _ensureAllowance(action.tokenIn, swapRouter, action.amountIn);
        uint24 fee = poolFees[action.tokenIn == stableAsset ? action.tokenOut : action.tokenIn];
        require(fee > 0, "fee not set");
     
        uint256 minOut = _computeAmountOutMin(action.tokenIn, action.tokenOut, action.amountIn);

        uint256 balInBefore = IERC20(action.tokenIn).balanceOf(address(this));
        uint256 balOutBefore = IERC20(action.tokenOut).balanceOf(address(this));

        uint256 amountOut = ISwapRouterLike(swapRouter).exactInputSingle(
            ISwapRouterLike.ExactInputSingleParams({
                tokenIn: action.tokenIn,
                tokenOut: action.tokenOut,
                fee: fee,
                recipient: address(this),
                amountIn: action.amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );

        uint256 balInAfter = IERC20(action.tokenIn).balanceOf(address(this));
        uint256 balOutAfter = IERC20(action.tokenOut).balanceOf(address(this));
        // Compute actual deltas
        uint256 actualIn = balInBefore > balInAfter ? (balInBefore - balInAfter) : 0;
        uint256 actualOut = balOutAfter > balOutBefore ? (balOutAfter - balOutBefore) : 0;
        // Sanity: exactInputSingle should spend exactly amountIn
        require(actualIn == action.amountIn, "unexpected input spent");
        // And return amountOut equal to measured delta
        require(actualOut == amountOut, "unexpected output received");
        swaps.push(SwapRecord({
            timestamp: block.timestamp,
            tokenIn: action.tokenIn,
            tokenOut: action.tokenOut,
            amountIn: actualIn,
            amountOut: actualOut,
            balanceInAfter: balInAfter,
            balanceOutAfter: balOutAfter
        }));

        emit SwapExecuted(action.tokenIn, action.tokenOut, actualIn, actualOut, block.timestamp, balInAfter, balOutAfter);
    }

    function _ensureAllowance(address token, address spender, uint256 amount) internal {
        uint256 current = IERC20(token).allowance(address(this), spender);
        if (current >= amount) return;
        if (current > 0) {
            // Some tokens (USDC-like) require zeroing before changing allowance
            require(IERC20(token).approve(spender, 0), "approve0");
        }
        // Approve max to avoid repeated approvals
        require(IERC20(token).approve(spender, type(uint256).max), "approve");
    }

    // View helpers to return full history arrays
    function getDeposits() external view returns (DepositRecord[] memory all) {
        all = new DepositRecord[](deposits.length);
        for (uint256 i = 0; i < deposits.length; i++) {
            all[i] = deposits[i];
        }
    }

    function getWithdrawals() external view returns (WithdrawRecord[] memory all) {
        all = new WithdrawRecord[](withdrawals.length);
        for (uint256 i = 0; i < withdrawals.length; i++) {
            all[i] = withdrawals[i];
        }
    }

    function getSwaps() external view returns (SwapRecord[] memory all) {
        all = new SwapRecord[](swaps.length);
        for (uint256 i = 0; i < swaps.length; i++) {
            all[i] = swaps[i];
        }
    }

    function getRiskAssets() external view returns (address[] memory assets) {
        assets = new address[](riskAssets.length);
        for (uint256 i = 0; i < riskAssets.length; i++) {
            assets[i] = riskAssets[i];
        }
    }
}


