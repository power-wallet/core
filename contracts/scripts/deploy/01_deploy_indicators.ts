import { ethers, upgrades, network, run } from "hardhat";
import { addresses } from "../../config/addresses";
import * as fs from 'fs';
import * as path from 'path';

interface CsvPriceRow { date: string; close: number; }

function loadCsvPrices(filename: string): CsvPriceRow[] {
  const filePath = path.join(__dirname, '../../config', filename);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CsvPriceRow[];
  return data;
}

function intersectLast200(btc: CsvPriceRow[], eth: CsvPriceRow[]) {
  const btcMap = new Map<string, number>(btc.map(r => [r.date, r.close]));
  const ethMap = new Map<string, number>(eth.map(r => [r.date, r.close]));
  const commonDates = Array.from(btcMap.keys())
    .filter(d => ethMap.has(d))
    .sort(); // ascending YYYY-MM-DD
  const last200 = commonDates.slice(-200);
  const parseUtcMidnight = (ymd: string): number => {
    const [Y, M, D] = ymd.split('-').map(Number);
    return Date.UTC(Y, M - 1, D) / 1000;
  };
  const startTimestamp = parseUtcMidnight(last200[0]);
  const btcPrices = last200.map(d => ethers.parseUnits(btcMap.get(d)!.toString(), 8));
  const ethPrices = last200.map(d => ethers.parseUnits(ethMap.get(d)!.toString(), 8));
  return { btcPrices, ethPrices, startTimestamp, lastDate: last200[last200.length - 1] };
}

async function main() {
    const networkName = network.name;
    const networkAddresses = addresses[networkName];

  const isLocal = networkName === "hardhat" || networkName === "localhost";
  if (!isLocal && !networkAddresses) {
    throw new Error(`No addresses configured for network ${networkName}`);
  }

    console.log(`Deploying TechnicalIndicators to ${networkName}...`);

  // Load historical price data (date/close) and compute last 200 aligned points
  console.log("Loading historical price data...");
  const btcCsv = loadCsvPrices('btc_daily.json');
  const ethCsv = loadCsvPrices('eth_daily.json');
  const { btcPrices: btcHistoricalPrices, ethPrices: ethHistoricalPrices, startTimestamp, lastDate } = intersectLast200(btcCsv, ethCsv);

    // Setup initialization parameters
  let tokens: string[];
  let priceFeeds: string[];

  if (isLocal) {
    console.log("Deploying local mocks for tokens and price feeds...");
    const MockToken = await ethers.getContractFactory("MockERC20");
    const wbtc = await MockToken.deploy("Wrapped Bitcoin", "WBTC");
    const weth = await MockToken.deploy("Wrapped Ether", "WETH");
    const btcLatest = btcHistoricalPrices[btcHistoricalPrices.length - 1];
    const ethLatest = ethHistoricalPrices[ethHistoricalPrices.length - 1];
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const btcFeed = await MockV3Aggregator.deploy(8, btcLatest);
    const ethFeed = await MockV3Aggregator.deploy(8, ethLatest);
    tokens = [await wbtc.getAddress(), await weth.getAddress()];
    priceFeeds = [await btcFeed.getAddress(), await ethFeed.getAddress()];
  } else {
    tokens = [networkAddresses.wbtc, networkAddresses.weth];
    priceFeeds = [networkAddresses.btcUsdPriceFeed, networkAddresses.ethUsdPriceFeed];
  }

  const historicalPrices = [btcHistoricalPrices, ethHistoricalPrices];
  const startTimes = [startTimestamp, startTimestamp];

  console.log("Deployment parameters:");
  console.log("- Tokens:", tokens);
  console.log("- Price Feeds:", priceFeeds);
  console.log("- Start Time:", new Date(startTimestamp * 1000).toISOString());
  console.log("- End Date:", lastDate);
  console.log("- Historical Data Points:", btcHistoricalPrices.length);
  console.log("- First BTC Price:", ethers.formatUnits(btcHistoricalPrices[0], 8));
  console.log("- First ETH Price:", ethers.formatUnits(ethHistoricalPrices[0], 8));

    // Get contract factory
    const TechnicalIndicators = await ethers.getContractFactory("TechnicalIndicators");

    // Deploy proxy
  const proxy = await upgrades.deployProxy(
    TechnicalIndicators,
    [tokens, priceFeeds, historicalPrices, startTimes],
    {
      kind: "uups",
      initializer: "initialize",
      timeout: 0
    }
  );

    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();

    console.log("TechnicalIndicators deployed to:", proxyAddress);
    console.log("Implementation deployed to:", await upgrades.erc1967.getImplementationAddress(proxyAddress));
    console.log("Admin address:", await upgrades.erc1967.getAdminAddress(proxyAddress));

    // Verify initial data
    console.log("\nVerifying initial data...");
    const contract = await ethers.getContractAt("TechnicalIndicators", proxyAddress);
    
    // Verify BTC data
    const btcLatestPrices = await contract.getLatestPrices(tokens[0], 1);
    console.log("Latest BTC price in contract:", ethers.formatUnits(btcLatestPrices[0].price, 8));
    
    // Verify ETH data
    const ethLatestPrices = await contract.getLatestPrices(tokens[1], 1);
    console.log("Latest ETH price in contract:", ethers.formatUnits(ethLatestPrices[0].price, 8));

    // Verify on block explorer if not on local network
    if (network.name !== "hardhat" && network.name !== "localhost") {
        console.log("\nWaiting for 5 block confirmations before verification...");
        await proxy.deploymentTransaction()?.wait(5);

        const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        
        console.log("Verifying implementation contract...");
        try {
            await run("verify:verify", {
                address: implAddress,
                constructorArguments: []
            });
        } catch (error) {
            console.log("Verification failed:", error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});