import { ethers, upgrades, network } from "hardhat";
import { addresses } from "../../config/addresses";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import * as fs from 'fs';
import * as path from 'path';

interface PriceData {
    timestamp: number;
    price: number;
}

function loadHistoricalPrices(filename: string): PriceData[] {
    const filePath = path.join(__dirname, '../../config', filename);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
}

function getLast200DaysPrices(prices: PriceData[]): [number[], number[]] {
    // Sort by timestamp in descending order
    prices.sort((a, b) => b.timestamp - a.timestamp);
    
    // Get last 200 days of data
    const last200Days = prices.slice(0, 200);
    
    // Convert prices to the contract's format (8 decimal places)
    const formattedPrices = last200Days.map(p => 
        ethers.parseUnits(p.price.toString(), 8)
    );
    
    // Get array of timestamps
    const timestamps = last200Days.map(p => p.timestamp);
    
    // Return prices array and timestamps array
    console.log("> formattedPrices: ", formattedPrices);
    console.log("> timestamps: ", timestamps);
    return [formattedPrices, timestamps];
}

async function main() {
    const networkName = network.name;
    const networkAddresses = addresses[networkName];

    if (!networkAddresses) {
        throw new Error(`No addresses configured for network ${networkName}`);
    }

    console.log(`Deploying TechnicalIndicators to ${networkName}...`);

    // Load historical price data
    console.log("Loading historical price data...");
    const btcPrices = loadHistoricalPrices('btc_daily.json');
    const ethPrices = loadHistoricalPrices('eth_daily.json');

    // Get last 200 days of prices with their timestamps
    const [btcHistoricalPrices, btcTimestamps] = getLast200DaysPrices(btcPrices);
    const [ethHistoricalPrices, ethTimestamps] = getLast200DaysPrices(ethPrices);

    // Setup initialization parameters
    const tokens = [
        networkAddresses.wbtc,
        networkAddresses.weth
    ];

    const priceFeeds = [
        networkAddresses.btcUsdPriceFeed,
        networkAddresses.ethUsdPriceFeed
    ];

    const historicalPrices = [
        btcHistoricalPrices,
        ethHistoricalPrices
    ];

    const startTimes = [
        btcTimestamps,
        ethTimestamps
    ];

    console.log("Deployment parameters:");
    console.log("- Tokens:", tokens);
    console.log("- Price Feeds:", priceFeeds);
    console.log("- BTC Start Time:", new Date(btcTimestamps[btcTimestamps.length - 1] * 1000).toISOString());
    console.log("- BTC End Time:", new Date(btcTimestamps[0] * 1000).toISOString());
    console.log("- ETH Start Time:", new Date(ethTimestamps[ethTimestamps.length - 1] * 1000).toISOString());
    console.log("- ETH End Time:", new Date(ethTimestamps[0] * 1000).toISOString());
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
            timeout: 0 // No timeout
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