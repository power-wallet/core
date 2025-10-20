import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import { addresses } from "../config/addresses";

dotenv.config();

// Addresses will be resolved from config based on network


async function main() {
    const networkName = network.name;
    const cfg = (addresses as any)[networkName];
    if (!cfg || !cfg.technicalIndicators) {
        throw new Error(`No technicalIndicators address configured for network ${networkName}`);
    }

    const indicators = await ethers.getContractAt("TechnicalIndicators", cfg.technicalIndicators);
    
    console.log(`Checking current price history...`);
    let latestPrices = await indicators.getLatestPrices(cfg.cbBTC ?? cfg.wbtc, 1);
    if (latestPrices.length > 0) {
        const lastTimestamp = latestPrices[0].timestamp;
        const lastDate = new Date(Number(lastTimestamp) * 1000).toISOString().split('T')[0];
        const lastPrice = ethers.formatUnits(latestPrices[0].price, 8);
        console.log(`  Last BTC price: ${lastDate} → $${lastPrice}`);
    } else {
        console.log(`  No existing BTC price history found`);
    }

    latestPrices = await indicators.getLatestPrices(cfg.weth, 1);
    if (latestPrices.length > 0) {
        const lastTimestamp = latestPrices[0].timestamp;
        const lastDate = new Date(Number(lastTimestamp) * 1000).toISOString().split('T')[0];
        const lastPrice = ethers.formatUnits(latestPrices[0].price, 8);
        console.log(`  Last ETH price: ${lastDate} → $${lastPrice}`);
    } else {
        console.log(`  No existing price ETH history found`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
