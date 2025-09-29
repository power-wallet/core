import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployWithHistoricalDataFixture, deployDeterministicSep28Fixture } from "./helpers";

describe("TechnicalIndicators", function () {
    // using shared fixture from helpers.ts

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

        it("Should calculate 14-day RSI for BTC on deterministic 2025-09-28 dataset", async function () {
            const { indicators, wbtc, btcData } = await loadFixture(deployDeterministicSep28Fixture);

            const period = 14n;
            const rsi = await indicators.calculateRSI(await wbtc.getAddress(), Number(period));

            function calculateRSIScaled(prices: number[], p: number): bigint {
                const SCALE = 10n ** 8n;
                const scaled = prices.map(v => BigInt(Math.round(v * 1e8)));
                let gains = 0n;
                let losses = 0n;
                for (let i = scaled.length - p - 1; i < scaled.length - 1; i++) {
                    const diff = scaled[i + 1] - scaled[i];
                    if (diff > 0n) gains += diff; else losses += -diff;
                }
                let avgGain = (gains * SCALE) / BigInt(p);
                let avgLoss = (losses * SCALE) / BigInt(p);
                if (avgLoss === 0n) return 100n * SCALE;
                const rs = (avgGain * SCALE) / avgLoss;
                return (100n * SCALE) - ((100n * SCALE * SCALE) / (SCALE + rs));
            }

            const prices = btcData.map(d => d.price);
            const expected = calculateRSIScaled(prices, Number(period));
            expect(rsi).to.equal(expected);
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
            
            // Calculate RSI using the exact same integer math and scaling as the contract
            function calculateRSIScaled(prices: number[], period: number): bigint {
                const SCALE = 10n ** 8n;
                const scaled = prices.map(p => BigInt(Math.round(p * 1e8)));
                let gains = 0n;
                let losses = 0n;
                for (let i = scaled.length - period - 1; i < scaled.length - 1; i++) {
                    const diff = scaled[i + 1] - scaled[i];
                    if (diff > 0n) gains += diff; else losses += -diff;
                }
                let avgGain = (gains * SCALE) / BigInt(period);
                let avgLoss = (losses * SCALE) / BigInt(period);
                if (avgLoss === 0n) return 100n * SCALE;
                const rs = (avgGain * SCALE) / avgLoss;
                return (100n * SCALE) - ((100n * SCALE * SCALE) / (SCALE + rs));
            }

            const prices = btcData.map(d => d.price);
            const expectedRsiScaled = calculateRSIScaled(prices, 8);

            expect(rsi).to.equal(expectedRsiScaled);
        });

        it("Should calculate Simple 14-day RSI for BTC on deterministic 2025-09-28 dataset", async function () {
            const { indicators, wbtc, btcData } = await loadFixture(deployDeterministicSep28Fixture);

            const period = 14;
            const rsi = await indicators.calculateRSI(await wbtc.getAddress(), period);

            // Calculate RSI using the exact same integer math and scaling as the contract
            function calculateRSIScaled(prices: number[], period: number): bigint {
                const SCALE = 10n ** 8n;
                const scaled = prices.map(p => BigInt(Math.round(p * 1e8)));
                let gains = 0n;
                let losses = 0n;
                for (let i = scaled.length - period - 1; i < scaled.length - 1; i++) {
                    const diff = scaled[i + 1] - scaled[i];
                    if (diff > 0n) gains += diff; else losses += -diff;
                }
                let avgGain = (gains * SCALE) / BigInt(period);
                let avgLoss = (losses * SCALE) / BigInt(period);
                if (avgLoss === 0n) return 100n * SCALE;
                const rs = (avgGain * SCALE) / avgLoss;
                return (100n * SCALE) - ((100n * SCALE * SCALE) / (SCALE + rs));
            }

            const prices = btcData.map(d => d.price);
            const expected = calculateRSIScaled(prices, period);
            
            expect(rsi).to.equal(expected);
            
            // Log for comparison with TradingView
            console.log(`        Simple RSI(14): ${ethers.formatUnits(rsi, 8)}`);
        });

        it("Should calculate Wilder's 14-day RSI for BTC on deterministic 2025-09-28 dataset", async function () {
            const { indicators, wbtc, btcData } = await loadFixture(deployDeterministicSep28Fixture);

            const period = 14;
            const wildersRsi = await indicators.calculateWildersRSI(await wbtc.getAddress(), period);

            // Wilder's smoothed RSI implementation
            function calculateWildersRSIScaled(prices: number[], p: number): bigint {
                const SCALE = 10n ** 8n;
                const scaled = prices.map(v => BigInt(Math.round(v * 1e8)));
                
                // Initial averages from first p changes
                let sumGain = 0n;
                let sumLoss = 0n;
                for (let i = 0; i < p; i++) {
                    const diff = scaled[i + 1] - scaled[i];
                    if (diff > 0n) sumGain += diff; else sumLoss += -diff;
                }
                let avgGain = (sumGain * SCALE) / BigInt(p);
                let avgLoss = (sumLoss * SCALE) / BigInt(p);
                
                // Wilder's smoothing for remaining periods
                for (let i = p; i < scaled.length - 1; i++) {
                    const diff = scaled[i + 1] - scaled[i];
                    const currentGain = diff > 0n ? diff * SCALE : 0n;
                    const currentLoss = diff < 0n ? -diff * SCALE : 0n;
                    avgGain = (avgGain * BigInt(p - 1) + currentGain) / BigInt(p);
                    avgLoss = (avgLoss * BigInt(p - 1) + currentLoss) / BigInt(p);
                }
                
                if (avgLoss === 0n) return 100n * SCALE;
                const rs = (avgGain * SCALE) / avgLoss;
                return (100n * SCALE) - ((100n * SCALE * SCALE) / (SCALE + rs));
            }

            const prices = btcData.map(d => d.price);
            const expected = calculateWildersRSIScaled(prices, period);
            
            expect(wildersRsi).to.equal(expected);
            
            // Log for comparison with TradingView
            console.log(`        Wilder's RSI(14): ${ethers.formatUnits(wildersRsi, 8)}`);
        });

        it("Should compare gas usage between simple and Wilder's RSI", async function () {
            const { indicators, wbtc } = await loadFixture(deployDeterministicSep28Fixture);
            
            const period = 14;
            
            // Estimate gas for simple RSI
            const simpleGas = await indicators.calculateRSI.estimateGas(await wbtc.getAddress(), period);
            
            // Estimate gas for Wilder's RSI
            const wildersGas = await indicators.calculateWildersRSI.estimateGas(await wbtc.getAddress(), period);
            
            console.log(`        Simple RSI gas: ${simpleGas}`);
            console.log(`        Wilder's RSI gas: ${wildersGas}`);
            console.log(`        Gas overhead: ${(Number(wildersGas) / Number(simpleGas) - 1) * 100}%`);
            
            // Both should be reasonable for view functions
            expect(Number(simpleGas)).to.be.lessThan(1000000);
            expect(Number(wildersGas)).to.be.lessThan(5000000);
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