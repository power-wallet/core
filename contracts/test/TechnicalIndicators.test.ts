import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployWithHistoricalDataFixture, deployDeterministicSep28Fixture } from "./helpers";

describe("TechnicalIndicators - Core Functionality", function () {
    // Helper to move to next day at midnight + 1 second (within 1-hour window)
    async function moveToNextDayStart() {
        const block = await ethers.provider.getBlock("latest");
        const currentTime = block!.timestamp;
        const today = currentTime - (currentTime % 86400);
        const tomorrow = today + 86400;
        const timeToAdd = tomorrow - currentTime + 1; // +1 second into new day
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
    }

    // Helper to close any gap between historical data and current time
    async function closeGapToPresent(indicators: any, owner: any, token: any, dummyPrice: string = "65000") {
        const history = await indicators.getLatestPrices(await token.getAddress(), 1);
        const lastTimestamp = history[0].timestamp;
        
        const block = await ethers.provider.getBlock("latest");
        const currentTime = block!.timestamp;
        const today = currentTime - (currentTime % 86400);
        const yesterday = today - 86400;
        
        // Backfill from day after last timestamp up to and including yesterday
        const timestamps = [];
        const prices = [];
        
        let ts = lastTimestamp + 86400n;
        while (ts <= yesterday) {
            timestamps.push(ts);
            prices.push(ethers.parseUnits(dummyPrice, 8)); // Dummy price
            ts += 86400n;
        }
        
        if (timestamps.length > 0) {
            await indicators.connect(owner).backfillDailyPrices(
                await token.getAddress(),
                timestamps,
                prices
            );
        }
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

        it("Should return full price history", async function () {
            const { indicators, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            const fullHistory = await indicators.getFullPriceHistory(await wbtc.getAddress());
            
            // Should have 200 days of historical data
            expect(fullHistory.length).to.equal(200);
            
            // Verify all timestamps are in chronological order
            for (let i = 0; i < fullHistory.length - 1; i++) {
                expect(fullHistory[i].timestamp).to.be.lt(fullHistory[i + 1].timestamp);
                // Each day should be exactly 1 day (86400 seconds) apart
                expect(fullHistory[i + 1].timestamp - fullHistory[i].timestamp).to.equal(86400n);
            }
            
            // Verify all prices are positive
            for (let i = 0; i < fullHistory.length; i++) {
                expect(fullHistory[i].price).to.be.gt(0n);
            }
        });
    });

    describe("Technical Indicators", function () {
        it("Should calculate 200-day SMA correctly", async function () {
            const { indicators, wbtc, btcData } = await loadFixture(deployWithHistoricalDataFixture);
            
            const sma = await indicators.calculateSMA(await wbtc.getAddress(), 200);
            
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
                await wbtc.getAddress(),
                5  // Default period from original constant
            );
            
            // RSI should be between 0 and 100 * SCALE (inclusive)
            expect(rsi).to.be.gte(0n);
            expect(rsi).to.be.lte(10000000000n); // 100 * 10^8
        });

        it("Should calculate SMA with different periods", async function () {
            const { indicators, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Test different valid periods
            const sma5 = await indicators.calculateSMA(await wbtc.getAddress(), 5);
            const sma50 = await indicators.calculateSMA(await wbtc.getAddress(), 50);
            const sma200 = await indicators.calculateSMA(await wbtc.getAddress(), 200);
            
            // All should be valid values
            expect(sma5).to.be.gt(0n);
            expect(sma50).to.be.gt(0n);
            expect(sma200).to.be.gt(0n);
            
            // Shorter periods should be more reactive (may differ more from longer periods)
            // Just verify they're all within reasonable bounds
        });

        it("Should reject SMA period out of range", async function () {
            const { indicators, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Test below minimum
            await expect(
                indicators.calculateSMA(await wbtc.getAddress(), 4)
            ).to.be.revertedWith("Period out of range");
            
            // Test above maximum
            await expect(
                indicators.calculateSMA(await wbtc.getAddress(), 201)
            ).to.be.revertedWith("Period out of range");
        });

        it("Should calculate ETH/BTC RSI with different periods", async function () {
            const { indicators, wbtc, weth } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Test different valid periods
            const rsi5 = await indicators.calculateEthBtcRSI(
                await weth.getAddress(),
                await wbtc.getAddress(),
                5
            );
            const rsi14 = await indicators.calculateEthBtcRSI(
                await weth.getAddress(),
                await wbtc.getAddress(),
                14
            );
            const rsi50 = await indicators.calculateEthBtcRSI(
                await weth.getAddress(),
                await wbtc.getAddress(),
                50
            );
            
            // All should be valid RSI values (0-100 * SCALE)
            expect(rsi5).to.be.gte(0n).and.lte(10000000000n);
            expect(rsi14).to.be.gte(0n).and.lte(10000000000n);
            expect(rsi50).to.be.gte(0n).and.lte(10000000000n);
        });

        it("Should reject ETH/BTC RSI period out of range", async function () {
            const { indicators, wbtc, weth } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Test below minimum
            await expect(
                indicators.calculateEthBtcRSI(
                    await weth.getAddress(),
                    await wbtc.getAddress(),
                    4
                )
            ).to.be.revertedWith("Period out of range");
            
            // Test above maximum
            await expect(
                indicators.calculateEthBtcRSI(
                    await weth.getAddress(),
                    await wbtc.getAddress(),
                    51
                )
            ).to.be.revertedWith("Period out of range");
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
            const { indicators, wbtc, btcFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Close gap to present
            await closeGapToPresent(indicators, owner, wbtc);
            
            // Move to next day start (within 1-hour window)
            await moveToNextDayStart();
            
            // Update price feed
            const newPrice = ethers.parseUnits("55000", 8);
            await btcFeed.updateAnswer(newPrice);
            
            // Update prices in contract (now within 1 hour after midnight)
            await indicators.updateDailyPrices([await wbtc.getAddress()]);
            
            // Get latest price - should be stored with yesterday's timestamp
            const latestPrices = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            expect(latestPrices[0].price).to.equal(newPrice);
        });

        it("Should not allow multiple updates in same day", async function () {
            const { indicators, wbtc, btcFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Close gap to present
            await closeGapToPresent(indicators, owner, wbtc);
            
            // Move to next day start
            await moveToNextDayStart();
            
            // First update within 1 hour window
            const firstPrice = ethers.parseUnits("55000", 8);
            await btcFeed.updateAnswer(firstPrice);
            await indicators.updateDailyPrices([await wbtc.getAddress()]);
            
            // Second update attempt in same day (still within 1 hour window)
            const secondPrice = ethers.parseUnits("56000", 8);
            await btcFeed.updateAnswer(secondPrice);
            await indicators.updateDailyPrices([await wbtc.getAddress()]);
            
            // Get latest prices - should still be first price (no duplicate entry)
            const history = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            expect(history[0].price).to.equal(firstPrice);
        });
    });

    describe("Volatility and Drawdown - incremental updates", function () {
        it("Updates latest annualized vol and drawdown across two daily updates", async function () {
            const { indicators, wbtc, btcFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);

            // Ensure history is contiguous up to yesterday
            await closeGapToPresent(indicators, owner, wbtc);

            // Move time to just after midnight (within 1-hour window)
            await moveToNextDayStart();

            // First update: set yesterday's close to baseline (establish peak)
            const latest = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            const basePrice = latest[0].price; // 1e8
            await btcFeed.updateAnswer(basePrice);

            // Trigger update, which also updates vol/drawdown
            await indicators.updateDailyPrices([await wbtc.getAddress()]);

            // Move to next day and set -20% price to generate drawdown and vol
            await moveToNextDayStart();
            const lowerPrice = (basePrice * 80n) / 100n; // -20%
            await btcFeed.updateAnswer(lowerPrice);
            await indicators.updateDailyPrices([await wbtc.getAddress()]);

            const [volAnn1e8] = await indicators.latestEwmaVolAnnualized(await wbtc.getAddress());
            const [dd1e8] = await indicators.latestDrawdown(await wbtc.getAddress());

            // Drawdown should be ~20% in 1e8 scale
            expect(dd1e8).to.equal(20_000000n);

            // Expected EWMA with previous sigma2=0: sigma2=(1-lambda)*r^2 using r from basePrice->lowerPrice
            const LAMBDA_BPS = 9400n;
            const oneMinus = 10000n - LAMBDA_BPS; // 600
            const rAbs1e8 = 20_000000n; // |r| in 1e8
            const r2_1e16 = rAbs1e8 * rAbs1e8; // 1e16 scale
            const sigma2_1e16 = (r2_1e16 * oneMinus) / 10000n;

            // Integer sqrt helper (same as contract logic)
            const isqrt = (x: bigint) => { let z = (x + 1n) / 2n, y = x; while (z < y) { y = z; z = (x / z + z) / 2n; } return y; };
            const volDaily1e8 = isqrt(sigma2_1e16);
            const SQRT_365_1e8 = 1910497317n;
            const expectedVolAnn1e8 = (volDaily1e8 * SQRT_365_1e8) / 100_000000n;

            expect(volAnn1e8).to.equal(expectedVolAnn1e8);
        });

        it("Owner can recompute indicators from full history", async function () {
            const { indicators, wbtc, btcFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);

            await closeGapToPresent(indicators, owner, wbtc);
            await moveToNextDayStart();

            // Establish base then drop 20%
            const latest = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            const basePrice = latest[0].price;
            await btcFeed.updateAnswer(basePrice);
            await indicators.updateDailyPrices([await wbtc.getAddress()]);

            await moveToNextDayStart();
            const lowerPrice = (basePrice * 80n) / 100n;
            await btcFeed.updateAnswer(lowerPrice);
            await indicators.updateDailyPrices([await wbtc.getAddress()]);

            // Compute expected drawdown using true running peak from full history
            const full = await indicators.getFullPriceHistory(await wbtc.getAddress());
            let peak = 0n;
            for (let i = 0; i < full.length; i++) {
                if (full[i].price > peak) peak = full[i].price;
            }
            const expectedDd1e8 = peak > 0n ? ((peak - lowerPrice) * 100_000000n) / peak : 0n;

            // Recompute from history
            await indicators.connect(owner).recomputeIndicators(await wbtc.getAddress());

            const after = await indicators.latestDrawdown(await wbtc.getAddress());
            expect(after[0]).to.equal(expectedDd1e8);
            // Timestamp should equal last entry timestamp
            expect(after[1]).to.equal(full[full.length - 1].timestamp);
        });
    });
});