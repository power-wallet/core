import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployWithHistoricalDataFixture } from "./helpers";

describe("Chainlink Automation & Backfill", function () {
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

    describe("Chainlink Automation", function () {
        it("Should return tracked tokens", async function () {
            const { indicators, wbtc, weth } = await loadFixture(deployWithHistoricalDataFixture);
            
            const trackedTokens = await indicators.getTrackedTokens();
            expect(trackedTokens.length).to.equal(2);
            expect(trackedTokens[0]).to.equal(await wbtc.getAddress());
            expect(trackedTokens[1]).to.equal(await weth.getAddress());
        });

        it("Should indicate upkeep is not needed on same day", async function () {
            const { indicators, wbtc, weth, btcFeed, ethFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Close gap to present
            await closeGapToPresent(indicators, owner, wbtc);
            await closeGapToPresent(indicators, owner, weth);
            
            // Move to next day start
            await moveToNextDayStart();
            
            // First perform an update to set lastUpdateTimestamp to today for both tokens
            const newBtcPrice = ethers.parseUnits("58000", 8);
            const newEthPrice = ethers.parseUnits("3200", 8);
            await btcFeed.updateAnswer(newBtcPrice);
            await ethFeed.updateAnswer(newEthPrice);
            await indicators.updateDailyPrices([await wbtc.getAddress(), await weth.getAddress()]);
            
            // Now check upkeep - should not be needed
            const [upkeepNeeded] = await indicators.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.false;
        });

        it("Should indicate upkeep is needed on new day", async function () {
            const { indicators, wbtc, weth, owner } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Close gap to present
            await closeGapToPresent(indicators, owner, wbtc);
            await closeGapToPresent(indicators, owner, weth);
            
            // Move to next day start
            await moveToNextDayStart();
            
            const [upkeepNeeded, performData] = await indicators.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.true;
            
            // Decode performData
            const decodedTokens = ethers.AbiCoder.defaultAbiCoder().decode(["address[]"], performData)[0];
            expect(decodedTokens.length).to.equal(2);
            expect(decodedTokens[0]).to.equal(await wbtc.getAddress());
            expect(decodedTokens[1]).to.equal(await weth.getAddress());
        });

        it("Should perform upkeep and update prices", async function () {
            const { indicators, wbtc, weth, btcFeed, ethFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Close gap to present
            await closeGapToPresent(indicators, owner, wbtc);
            await closeGapToPresent(indicators, owner, weth);
            
            // Move to next day start
            await moveToNextDayStart();
            
            // Set new prices
            const newBtcPrice = ethers.parseUnits("60000", 8);
            const newEthPrice = ethers.parseUnits("3500", 8);
            await btcFeed.updateAnswer(newBtcPrice);
            await ethFeed.updateAnswer(newEthPrice);
            
            // Check upkeep
            const [upkeepNeeded, performData] = await indicators.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.true;
            
            // Perform upkeep
            await indicators.performUpkeep(performData);
            
            // Verify prices were updated
            const btcLatest = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            const ethLatest = await indicators.getLatestPrices(await weth.getAddress(), 1);
            expect(btcLatest[0].price).to.equal(newBtcPrice);
            expect(ethLatest[0].price).to.equal(newEthPrice);
        });

        it("Should not perform upkeep when not needed", async function () {
            const { indicators, wbtc, weth, btcFeed, ethFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Close gap to present
            await closeGapToPresent(indicators, owner, wbtc);
            await closeGapToPresent(indicators, owner, weth);
            
            // Move to next day start
            await moveToNextDayStart();
            
            // First perform an update to set lastUpdateTimestamp to today for both tokens
            const newBtcPrice = ethers.parseUnits("59000", 8);
            const newEthPrice = ethers.parseUnits("3300", 8);
            await btcFeed.updateAnswer(newBtcPrice);
            await ethFeed.updateAnswer(newEthPrice);
            await indicators.updateDailyPrices([await wbtc.getAddress(), await weth.getAddress()]);
            
            const [, performData] = await indicators.checkUpkeep("0x");
            
            // Try to perform upkeep again without more time passing
            await expect(indicators.performUpkeep(performData))
                .to.be.revertedWith("No update needed");
        });

        it("Should only perform upkeep once per day", async function () {
            const { indicators, wbtc, weth, btcFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Close gap to present for both tokens
            await closeGapToPresent(indicators, owner, wbtc);
            await closeGapToPresent(indicators, owner, weth, "3000");
            
            // Move to next day start
            await moveToNextDayStart();
            
            // Set new price
            const newPrice = ethers.parseUnits("65000", 8);
            await btcFeed.updateAnswer(newPrice);
            
            // First upkeep should succeed
            const [, performData] = await indicators.checkUpkeep("0x");
            await indicators.performUpkeep(performData);
            
            // Second upkeep on same day should fail
            await expect(indicators.performUpkeep(performData))
                .to.be.revertedWith("No update needed");
            
            // Check upkeep should return false
            const [upkeepNeeded] = await indicators.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.false;
        });

        it("Should prevent upkeep when gap would be created", async function () {
            const { indicators, wbtc, btcFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Close gap to present
            await closeGapToPresent(indicators, owner, wbtc);
            
            // Move forward 1 day and update (this works)
            await moveToNextDayStart();
            const price1 = ethers.parseUnits("70000", 8);
            await btcFeed.updateAnswer(price1);
            await indicators.updateDailyPrices([await wbtc.getAddress()]);
            
            // Move forward 2 more days (skip day 2) - creating a gap scenario
            await moveToNextDayStart();
            await moveToNextDayStart();
            
            const price2 = ethers.parseUnits("72000", 8);
            await btcFeed.updateAnswer(price2);
            
            // checkUpkeep should return false due to gap detection
            const [upkeepNeeded] = await indicators.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.false;
            
            // Manual update should also fail
            await expect(
                indicators.updateDailyPrices([await wbtc.getAddress()])
            ).to.be.revertedWith("Gap detected: missing previous day price");
        });
    });

    describe("Manual Backfill", function () {
        it("Should allow owner to backfill missing prices", async function () {
            const { indicators, owner, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Get the last timestamp in history
            const history = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            const lastTimestamp = history[0].timestamp;
            
            // Backfill next 3 days
            const timestamps = [
                lastTimestamp + 86400n,
                lastTimestamp + 86400n * 2n,
                lastTimestamp + 86400n * 3n
            ];
            const prices = [
                ethers.parseUnits("70000", 8),
                ethers.parseUnits("71000", 8),
                ethers.parseUnits("72000", 8)
            ];
            
            await indicators.connect(owner).backfillDailyPrices(
                await wbtc.getAddress(),
                timestamps,
                prices
            );
            
            // Verify prices were added
            const newHistory = await indicators.getLatestPrices(await wbtc.getAddress(), 3);
            expect(newHistory[0].timestamp).to.equal(timestamps[0]);
            expect(newHistory[0].price).to.equal(prices[0]);
            expect(newHistory[2].timestamp).to.equal(timestamps[2]);
            expect(newHistory[2].price).to.equal(prices[2]);
        });

        it("Should reject backfill with gaps", async function () {
            const { indicators, owner, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            const history = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            const lastTimestamp = history[0].timestamp;
            
            // Try to backfill with a gap (skip day 1)
            const timestamps = [
                lastTimestamp + 86400n * 2n,  // Skip day 1
                lastTimestamp + 86400n * 3n
            ];
            const prices = [
                ethers.parseUnits("70000", 8),
                ethers.parseUnits("71000", 8)
            ];
            
            await expect(
                indicators.connect(owner).backfillDailyPrices(
                    await wbtc.getAddress(),
                    timestamps,
                    prices
                )
            ).to.be.revertedWith("Gap between existing data and backfill");
        });

        it("Should reject backfill from non-owner", async function () {
            const { indicators, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            const [, nonOwner] = await ethers.getSigners();
            
            const history = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            const lastTimestamp = history[0].timestamp;
            
            const timestamps = [lastTimestamp + 86400n];
            const prices = [ethers.parseUnits("70000", 8)];
            
            await expect(
                indicators.connect(nonOwner).backfillDailyPrices(
                    await wbtc.getAddress(),
                    timestamps,
                    prices
                )
            ).to.be.reverted;
        });

        it("Should reject backfill with non-midnight timestamps", async function () {
            const { indicators, owner, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            const history = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            const lastTimestamp = history[0].timestamp;
            
            // Non-midnight timestamp
            const timestamps = [lastTimestamp + 86400n + 3600n];  // +1 hour
            const prices = [ethers.parseUnits("70000", 8)];
            
            await expect(
                indicators.connect(owner).backfillDailyPrices(
                    await wbtc.getAddress(),
                    timestamps,
                    prices
                )
            ).to.be.revertedWith("Timestamp must be UTC midnight");
        });

        it("Should prevent automation from creating gaps", async function () {
            const { indicators, wbtc, btcFeed, owner } = await loadFixture(deployWithHistoricalDataFixture);
            
            // Close gap to present
            await closeGapToPresent(indicators, owner, wbtc);
            
            // Move forward 1 day and update (this works)
            await moveToNextDayStart();
            const price1 = ethers.parseUnits("70000", 8);
            await btcFeed.updateAnswer(price1);
            await indicators.updateDailyPrices([await wbtc.getAddress()]);
            
            // Move forward 2 more days (skip day 2) and try to update
            await moveToNextDayStart();
            await moveToNextDayStart();
            
            const price2 = ethers.parseUnits("72000", 8);
            await btcFeed.updateAnswer(price2);
            
            // This should revert due to gap detection
            await expect(
                indicators.updateDailyPrices([await wbtc.getAddress()])
            ).to.be.revertedWith("Gap detected: missing previous day price");
        });

        it("Should skip duplicate updates in same backfill", async function () {
            const { indicators, owner, wbtc } = await loadFixture(deployWithHistoricalDataFixture);
            
            const history = await indicators.getLatestPrices(await wbtc.getAddress(), 1);
            const lastTimestamp = history[0].timestamp;
            
            // First backfill
            const timestamps1 = [lastTimestamp + 86400n];
            const prices1 = [ethers.parseUnits("70000", 8)];
            await indicators.connect(owner).backfillDailyPrices(
                await wbtc.getAddress(),
                timestamps1,
                prices1
            );
            
            // Try to backfill same day again - should fail
            await expect(
                indicators.connect(owner).backfillDailyPrices(
                    await wbtc.getAddress(),
                    timestamps1,
                    prices1
                )
            ).to.be.revertedWith("Timestamps must be chronological and after existing data");
        });
    });
});
