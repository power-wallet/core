import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { TechnicalIndicators } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import * as fs from 'fs';
import * as path from 'path';

interface PriceData {
    timestamp: number;
    price: number;
}

describe("TechnicalIndicators", function () {
    // Fixture that deploys the contract with real historical data
    async function deployWithHistoricalDataFixture() {
        const [owner] = await ethers.getSigners();

        // Deploy mock tokens
        const MockToken = await ethers.getContractFactory("MockERC20");
        const wbtc = await MockToken.deploy("Wrapped Bitcoin", "WBTC");
        const weth = await MockToken.deploy("Wrapped Ether", "WETH");

        // Deploy mock price feeds
        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        const btcFeed = await MockV3Aggregator.deploy(8, ethers.parseUnits("50000", 8));
        const ethFeed = await MockV3Aggregator.deploy(8, ethers.parseUnits("3000", 8));

        // Use a fixed start time for testing (Jan 1, 2024 00:00:00 UTC)
        const startTimestamp = 1704067200;
        const day = 24 * 60 * 60;
        
        const mockData = (basePrice: number): PriceData[] => {
            return Array.from({ length: 200 }, (_, i) => ({
                timestamp: startTimestamp + (i * day),
                price: basePrice + (i * 100)  // Price increases by $100 each day
            }));
        };

        const btcData = mockData(40000);  // BTC starting at 40k
        const ethData = mockData(2000);   // ETH starting at 2k

        // Use all 200 days of data
        const sortedBtcData = btcData;
        const sortedEthData = ethData;

        // Convert prices to BigNumber with 8 decimals
        const btcPrices = sortedBtcData.map(d => ethers.parseUnits(d.price.toString(), 8));
        const ethPrices = sortedEthData.map(d => ethers.parseUnits(d.price.toString(), 8));
        
        // Convert timestamps to ethers.BigNumber
        const btcTimestamps = ethers.getBigInt(startTimestamp);  // no decimals for timestamp
        const ethTimestamps = ethers.getBigInt(startTimestamp);

        // Deploy TechnicalIndicators
        const TechnicalIndicators = await ethers.getContractFactory("TechnicalIndicators");
        const indicators = await upgrades.deployProxy(
            TechnicalIndicators,
            [
                [await wbtc.getAddress(), await weth.getAddress()],
                [await btcFeed.getAddress(), await ethFeed.getAddress()],
                [btcPrices, ethPrices],
                [btcTimestamps, ethTimestamps]
            ],
            { kind: "uups" }
        );

        return {
            indicators,
            owner,
            wbtc,
            weth,
            btcFeed,
            ethFeed,
            btcData: sortedBtcData,
            ethData: sortedEthData,
            startTimestamp,
            day
        };
    }

    describe("Deployment", function () {
        it("Should deploy with historical data", async function () {
            const { indicators, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Verify we have price history
            const latestPrices = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            expect(latestPrices.length).to.equal(1);
            expect(latestPrices[0].price).to.not.equal(0);
        });

        it("Should store correct timestamps", async function () {
            const { indicators, wbtc, startTimestamp, day } = await loadFixture(deployWithHistoricalDataFixture);
            
            const startTime = ethers.getBigInt(startTimestamp);
            const endTime = ethers.getBigInt(startTimestamp + (200 * day));
            const history = await indicators.getPriceHistory(
                await wbtc.getAddress(),
                startTime,
                endTime
            );

            expect(history.length).to.equal(200);
            expect(history[0].timestamp).to.equal(startTime);
            expect(history[history.length - 1].timestamp).to.equal(ethers.getBigInt(startTimestamp + (199 * day)));
        });
    });

    describe("Technical Indicators", function () {
        it("Should calculate 200-day SMA correctly", async function () {
            const { indicators, wbtc, btcData } = await loadFixture(deployWithHistoricalDataFixture);
            
            const sma = await indicators.calculateSMA(await wbtc.getAddress());
            
            // Calculate expected SMA
            const expectedSma = btcData.reduce((sum, data) => sum + data.price, 0) / btcData.length;
            const expectedSmaScaled = ethers.parseUnits(expectedSma.toString(), 8);
            
            // Allow for small rounding differences
            const difference = sma - expectedSmaScaled;
            expect(Math.abs(Number(difference))).to.be.lessThan(1e8); // Less than $1 difference
        });

        it("Should calculate RSI correctly", async function () {
            const { indicators, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            const rsi = await indicators.calculateRSI(await wbtc.getAddress(), 8);
            
            // RSI should be between 0 and 100 * SCALE (inclusive)
            expect(rsi).to.be.gte(0n);
            expect(rsi).to.be.lte(10000000000n); // 100 * 10^8
        });

        it("Should calculate ETH/BTC RSI correctly", async function () {
            const { indicators, wbtc, weth } = await loadFixture(deployWithHistoricalDataFixture);
            
            const rsi = await indicators.calculateEthBtcRSI(
                await weth.getAddress(),
                await wbtc.getAddress()
            );
            
            // RSI should be between 0 and 100 * SCALE (inclusive)
            expect(rsi).to.be.gte(0n);
            expect(rsi).to.be.lte(10000000000n); // 100 * 10^8
        });

        it("Should match Python strategy RSI values", async function () {
            const { indicators, wbtc, btcData } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Get RSI from contract
            const rsi = await indicators.calculateRSI(await wbtc.getAddress(), 8);
            
            // Calculate RSI using the same logic as the Python code
            function calculateRSI(prices: number[], period: number): number {
                let gains = 0;
                let losses = 0;
                
                for (let i = prices.length - period - 1; i < prices.length - 1; i++) {
                    const diff = prices[i + 1] - prices[i];
                    if (diff > 0) gains += diff;
                    else losses -= diff;
                }
                
                const avgGain = gains / period;
                const avgLoss = losses / period;
                
                if (avgLoss === 0) return 100;
                
                const rs = avgGain / avgLoss;
                return 100 - (100 / (1 + rs));
            }
            
            const prices = btcData.map(d => d.price);
            const expectedRsi = calculateRSI(prices, 8);
            const expectedRsiScaled = ethers.parseUnits(expectedRsi.toString(), 8);
            
            // Allow for small rounding differences
            const difference = rsi - expectedRsiScaled;
            expect(Math.abs(Number(difference))).to.be.lessThan(1e8); // Less than $1 difference
        });
    });

    describe("Price Updates", function () {
        it("Should update prices correctly", async function () {
            const { indicators, wbtc, btcFeed } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Update price feed
            const newPrice = ethers.parseUnits("55000", 8);
            await btcFeed.updateAnswer(newPrice);
            
            // Update prices in contract
            await indicators.updateDailyPrices([await wbtc.getAddress()]);
            
            // Get latest price
            const latestPrices = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            expect(latestPrices[0].price).to.equal(newPrice);
        });

        it("Should not allow multiple updates in same day", async function () {
            const { indicators, wbtc, btcFeed } = await loadFixture(deployWithHistoricalDataFixture);
            
            // First update
            const firstPrice = ethers.parseUnits("55000", 8);
            await btcFeed.updateAnswer(firstPrice);
            await indicators.updateDailyPrices([await wbtc.getAddress()]);
            
            // Second update in same day
            const secondPrice = ethers.parseUnits("56000", 8);
            await btcFeed.updateAnswer(secondPrice);
            await indicators.updateDailyPrices([await wbtc.getAddress()]);
            
            // Get latest prices - latest should still be first price
            const history = await indicators.getLatestPrices(await wbtc.getAddress(), 2);
            expect(history[1].price).to.equal(firstPrice);
        });
    });
});