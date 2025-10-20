import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import { addresses } from "../config/addresses";

dotenv.config();

/**
 * Script to backfill historical daily prices for a token
 * 
 * Usage:
 * npx hardhat run scripts/backfill-prices.ts --network base-sepolia
 */

async function main() {
    // ============================================
    // CONFIGURATION - UPDATE THESE VALUES
    // ============================================
    
    // Resolve contract address from config
    const networkName = network.name;
    const cfg = (addresses as any)[networkName];
    if (!cfg || !cfg.technicalIndicators) {
        throw new Error(`No technicalIndicators address configured for network ${networkName}`);
    }
    
    // Token address to backfill prices for
    // const TOKEN_ADDRESS = "0xcbB7C0006F23900c38EB856149F799620fcb8A4a"; // cbBTC
    const TOKEN_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH
    
    // Array of dates in YYYY-MM-DD format
    const DATES = [
        "2025-09-29",
        // Add more dates...
    ];
    
    // Array of prices (will be scaled to 8 decimals)
    // These should be raw numbers like 65000.50 for $65,000.50
    const PRICES = [
        // 114365.07,
        4217.25
        // Add more prices... (must match DATES length)
    ];
    
    // ============================================
    // VALIDATION
    // ============================================
    
    if (DATES.length === 0) {
        throw new Error("DATES array is empty");
    }
    
    if (DATES.length !== PRICES.length) {
        throw new Error(`DATES length (${DATES.length}) must match PRICES length (${PRICES.length})`);
    }
    
    console.log(`\n========================================`);
    console.log(`Backfilling Daily Prices`);
    console.log(`========================================`);
    console.log(`Network: ${network.name}`);
    console.log(`Contract: ${cfg.technicalIndicators}`);
    console.log(`Token: ${TOKEN_ADDRESS}`);
    console.log(`Data Points: ${DATES.length}`);
    console.log(`========================================\n`);
    
    // ============================================
    // SETUP
    // ============================================
    
    const [deployer] = await ethers.getSigners();
    console.log(`Using account: ${deployer.address}`);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);
    
    // Get contract instance
    const indicators = await ethers.getContractAt("TechnicalIndicators", cfg.technicalIndicators);
    
    // Verify deployer is owner
    const owner = await indicators.owner();
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        throw new Error(`Deployer ${deployer.address} is not the owner (${owner})`);
    }
    console.log(`✓ Verified deployer is contract owner\n`);
    
    // ============================================
    // PREPARE DATA
    // ============================================
    
    console.log(`Preparing data...`);
    
    // Convert dates to UTC midnight timestamps
    const parseUtcMidnight = (ymd: string): number => {
        const [year, month, day] = ymd.split("-").map(Number);
        if (!year || !month || !day) {
            throw new Error(`Invalid date format: ${ymd}. Expected YYYY-MM-DD`);
        }
        return Date.UTC(year, month - 1, day) / 1000;
    };
    
    const timestamps: bigint[] = [];
    const scaledPrices: bigint[] = [];
    
    for (let i = 0; i < DATES.length; i++) {
        const timestamp = parseUtcMidnight(DATES[i]);
        timestamps.push(BigInt(timestamp));
        
        // Scale price to 8 decimals
        const scaledPrice = ethers.parseUnits(PRICES[i].toString(), 8);
        scaledPrices.push(scaledPrice);
        
        console.log(`  ${i + 1}. ${DATES[i]} → ${new Date(timestamp * 1000).toISOString()} | Price: $${PRICES[i].toLocaleString()}`);
    }
    
    console.log(`\n✓ Prepared ${timestamps.length} data points\n`);
    
    // ============================================
    // VALIDATE CHRONOLOGICAL ORDER
    // ============================================
    
    console.log(`Validating chronological order...`);
    for (let i = 0; i < timestamps.length - 1; i++) {
        if (timestamps[i] >= timestamps[i + 1]) {
            throw new Error(`Timestamps not in chronological order at index ${i}: ${DATES[i]} >= ${DATES[i + 1]}`);
        }
        
        // Check for exactly 1 day spacing
        const dayDiff = Number(timestamps[i + 1] - timestamps[i]) / 86400;
        if (dayDiff !== 1) {
            console.log(`  ⚠️  Warning: ${DATES[i]} to ${DATES[i + 1]} is ${dayDiff} days apart (not consecutive)`);
        }
    }
    console.log(`✓ Timestamps are valid\n`);
    
    // ============================================
    // CHECK CURRENT STATE
    // ============================================
    
    console.log(`Checking current price history...`);
    try {
        const latestPrices = await indicators.getLatestPrices(TOKEN_ADDRESS, 1);
        if (latestPrices.length > 0) {
            const lastTimestamp = latestPrices[0].timestamp;
            const lastDate = new Date(Number(lastTimestamp) * 1000).toISOString().split('T')[0];
            const lastPrice = ethers.formatUnits(latestPrices[0].price, 8);
            console.log(`  Last stored price: ${lastDate} → $${lastPrice}`);
            console.log(`  First backfill date: ${DATES[0]}`);
            
            // Check for gaps
            const expectedNext = lastTimestamp + 86400n;
            if (timestamps[0] !== expectedNext) {
                const dayDiff = Number(timestamps[0] - lastTimestamp) / 86400;
                console.log(`  ⚠️  Warning: Gap of ${dayDiff} days between last stored and first backfill date`);
            }
        } else {
            console.log(`  No existing price history found`);
        }
    } catch (error) {
        console.log(`  Could not read existing history (token may not be configured)`);
    }
    console.log();
    
    // ============================================
    // EXECUTE BACKFILL
    // ============================================
    
    console.log(`Executing backfill transaction...`);
    console.log(`This may take a moment...\n`);
    
    try {
        const tx = await indicators.backfillDailyPrices(
            TOKEN_ADDRESS,
            timestamps,
            scaledPrices
        );
        
        console.log(`Transaction sent: ${tx.hash}`);
        console.log(`Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        
        console.log(`\n✅ Transaction confirmed!`);
        console.log(`  Block: ${receipt?.blockNumber}`);
        console.log(`  Gas used: ${receipt?.gasUsed.toString()}`);
        
        // Calculate cost
        if (receipt?.gasPrice) {
            const cost = receipt.gasUsed * receipt.gasPrice;
            console.log(`  Cost: ${ethers.formatEther(cost)} ETH`);
        }
        
        // Parse events
        if (receipt?.logs) {
            const priceAddedEvents = receipt.logs.filter(log => {
                try {
                    const parsed = indicators.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === "PriceAdded";
                } catch {
                    return false;
                }
            });
            console.log(`  Prices added: ${priceAddedEvents.length}`);
        }
        
    } catch (error: any) {
        console.error(`\n❌ Transaction failed!`);
        if (error.message) {
            console.error(`Error: ${error.message}`);
        }
        throw error;
    }
    
    // ============================================
    // VERIFY BACKFILL
    // ============================================
    
    console.log(`\nVerifying backfill...`);
    
    const latestPrices = await indicators.getLatestPrices(TOKEN_ADDRESS, Math.min(3, DATES.length));
    console.log(`Latest prices in contract:`);
    for (let i = latestPrices.length - 1; i >= 0; i--) {
        const ts = Number(latestPrices[i].timestamp);
        const date = new Date(ts * 1000).toISOString().split('T')[0];
        const price = ethers.formatUnits(latestPrices[i].price, 8);
        console.log(`  ${date} → $${price}`);
    }
    
    console.log(`\n========================================`);
    console.log(`✅ Backfill completed successfully!`);
    console.log(`========================================\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
