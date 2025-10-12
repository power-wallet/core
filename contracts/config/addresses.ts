import { strategies } from "../typechain-types/contracts";

export interface ChainAddresses {
  // Core protocol addresses
  uniswapV3Factory: string;
  uniswapV3Router: string;
  
  // Tokens
  usdc: string;
  cbBTC?: string;  // Not available on all chains
  wbtc?: string;
  weth: string;
  cbETH?: string;  // Not available on all chains
  
  // Chainlink Price Feeds
  btcUsdPriceFeed: string;
  ethUsdPriceFeed: string;
  usdcUsdPriceFeed: string;

  walletFactory?: string;  // optional, deployed addresses
  strategyRegistry?: string; // optional, deployed addresses
  technicalIndicators?: string; // optional, deployed addresses
  automator?: string; // optional, deployed addresses
  faucet?: string; // optional, deployed addresses

  // strategy map
  strategies: {
    [key: string]: string | undefined;
  };
}

export const addresses: Record<string, ChainAddresses> = {

    // Base Sepolia (Testnet)
  "base-sepolia": {
    // Uniswap V3
    uniswapV3Factory: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    uniswapV3Router: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
    
    // Tokens
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  // USDC
    weth: "0x4200000000000000000000000000000000000006",  // WETH
    cbBTC: "0xcbB7C0006F23900c38EB856149F799620fcb8A4a",  // cbBTC
    
    // Chainlink Price Feeds
    btcUsdPriceFeed: "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298",
    ethUsdPriceFeed: "0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1",
    usdcUsdPriceFeed: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165 ",
    
    walletFactory: "0x6e6A4C1094a064030c30607549BF8d87311cB219",
    strategyRegistry: "0x53B4C7F51904b888f61859971B11ff51a8e43F80",
    technicalIndicators: "0x7A0F3B371A2563627EfE1967E7645812909Eb6c5",
    automator: "0x79cec041e963526122ffC7C04F427595a132331B",
    faucet: "0x2718B8da434e4De40B05f85bf33B47B1fCa192C0",
    
    strategies: {
      'simple-btc-dca-v1': '0x97ee87073A5a430006020A60fC8F6190Fc9Fe082', // deployed SimpleDCA on Base Sepolia
      'btc-dca-power-law-v1': '0x508Fd840B7bDEF406585CC89b717D93B53996DA1',
      'power-btc-dca-v1': '0xc0e60CB3c797c77350581153AFd52434ef9Ed506'
    }
  },

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
    btcUsdPriceFeed: "0x07DA0E54543a844a80ABE69c8A12F22B3aA59f9D",
    ethUsdPriceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    usdcUsdPriceFeed: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B",
    
    walletFactory: "",
    strategyRegistry: "",
    technicalIndicators: "",
    automator: "",

    strategies: {}
  },
}