export interface ChainAddresses {
  // Core protocol addresses
  uniswapV3Factory: string;
  uniswapV3Router: string;
  
  // Tokens
  usdc: string;
  weth: string;
  wbtc: string;
  cbETH?: string;  // Not available on all chains
  cbBTC?: string;  // Not available on all chains
  
  // Chainlink Price Feeds
  btcUsdPriceFeed: string;
  ethUsdPriceFeed: string;
}

export const addresses: Record<string, ChainAddresses> = {
  // Base Mainnet
  "base": {
    // Uniswap V3
    uniswapV3Factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    uniswapV3Router: "0x2626664c2603336E57B271c5C0b26F421741e481",
    
    // Tokens
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  // USDC.e
    weth: "0x4200000000000000000000000000000000000006",
    wbtc: "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b",
    cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    cbBTC: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
    
    // Chainlink Price Feeds
    btcUsdPriceFeed: "0xCf5F5b97F0670A1a9aFc98e6738435D40B444589",
    ethUsdPriceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"
  },
  
  // Base Sepolia (Testnet)
  "base-sepolia": {
    // Uniswap V3
    uniswapV3Factory: "0x9323c1d6D800ed51Bd7C6B216cfBec678B7d0BC2",
    uniswapV3Router: "0x4F84662a1317BE05B8F66F31AeA0c3e5398CC5f1",
    
    // Tokens
    usdc: "0x036CbD53842c5426634e7929541eC2018491cf960",  // Mock USDC
    weth: "0x4200000000000000000000000000000000000006",
    wbtc: "0x29f2D40B0605204364af54EC677bD022dA425d03",  // Mock WBTC
    
    // Chainlink Price Feeds
    btcUsdPriceFeed: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
    ethUsdPriceFeed: "0xcD2A119bD1F7DF95d706DE6F2057fDD45A0503E2"
  },
  
  // Ethereum Sepolia (Testnet)
  "sepolia": {
    // Uniswap V3
    uniswapV3Factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    uniswapV3Router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    
    // Tokens
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",  // Mock USDC
    weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",  // WETH
    wbtc: "0x29f2D40B0605204364af54EC677bD022dA425d03",  // Mock WBTC
    
    // Chainlink Price Feeds
    btcUsdPriceFeed: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
    ethUsdPriceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306"
  }
}