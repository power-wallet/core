import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

// Proxy address of the deployed TechnicalIndicators contract
const PROXY_ADDRESS = "0x7A0F3B371A2563627EfE1967E7645812909Eb6c5";

// Token address to backfill prices for
const CBBTC_TOKEN_ADDRESS = "0xcbB7C0006F23900c38EB856149F799620fcb8A4a"; // cbBTC
const WETC_TOKEN_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH


async function main() {

    // Get contract instance
    const indicators = await ethers.getContractAt("TechnicalIndicators", PROXY_ADDRESS);
    
    console.log(`Checking current price history...`);
    let latestPrices = await indicators.getLatestPrices(CBBTC_TOKEN_ADDRESS, 1);
    if (latestPrices.length > 0) {
        const lastTimestamp = latestPrices[0].timestamp;
        const lastDate = new Date(Number(lastTimestamp) * 1000).toISOString().split('T')[0];
        const lastPrice = ethers.formatUnits(latestPrices[0].price, 8);
        console.log(`  Last BTC price: ${lastDate} → $${lastPrice}`);
    } else {
        console.log(`  No existing BTC price history found`);
    }

    latestPrices = await indicators.getLatestPrices(WETC_TOKEN_ADDRESS, 1);
    if (latestPrices.length > 0) {
        const lastTimestamp = latestPrices[0].timestamp;
        const lastDate = new Date(Number(lastTimestamp) * 1000).toISOString().split('T')[0];
        const lastPrice = ethers.formatUnits(latestPrices[0].price, 8);
        console.log(`  Last ETH price: ${lastDate} → $${lastPrice}`);
    } else {
        console.log(`  No existing price ETH history found`);
    }



 
    console.log();

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
