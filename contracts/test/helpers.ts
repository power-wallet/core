import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface PriceData {
    timestamp: number;
    price: number;
}

export async function deployWithHistoricalDataFixture() {
    const [owner] = await ethers.getSigners();

    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockERC20");
    const wbtc = await MockToken.deploy("Wrapped Bitcoin", "WBTC");
    const weth = await MockToken.deploy("Wrapped Ether", "WETH");

    // Deploy mock price feeds
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    
    // Load real historical prices (most recent 200 points)
    const btcPath = path.resolve(__dirname, "../config/btc_daily.json");
    const ethPath = path.resolve(__dirname, "../config/eth_daily.json");
    const btcJson = JSON.parse(fs.readFileSync(btcPath, "utf8")) as { date: string; close: number; }[];
    const ethJson = JSON.parse(fs.readFileSync(ethPath, "utf8")) as { date: string; close: number; }[];

    const takeLast = <T>(arr: T[], n: number): T[] => arr.slice(-n);
    // Build maps by date for intersection
    const btcByDate = new Map<string, number>(btcJson.map(r => [r.date, r.close]));
    const ethByDate = new Map<string, number>(ethJson.map(r => [r.date, r.close]));

    // Intersect dates and sort ascending, take the last 200
    const commonDates = Array.from(btcByDate.keys())
        .filter(d => ethByDate.has(d))
        .sort();

    const last200Dates = commonDates.slice(-200);

    // Parse YYYY-MM-DD to UTC midnight timestamps and build scaled price arrays
    const parseUtcMidnight = (ymd: string): number => {
        const [year, month, day] = ymd.split("-").map(Number);
        return Date.UTC(year, month - 1, day) / 1000;
    };

    const startTimestamp = parseUtcMidnight(last200Dates[0]);
    const endTimestamp = parseUtcMidnight(last200Dates[last200Dates.length - 1]);
    const btcPrices = last200Dates.map(d => ethers.parseUnits(btcByDate.get(d)!.toString(), 8));
    const ethPrices = last200Dates.map(d => ethers.parseUnits(ethByDate.get(d)!.toString(), 8));
    const btcTimestamps = ethers.getBigInt(startTimestamp);
    const ethTimestamps = ethers.getBigInt(startTimestamp);

    // No need to manipulate time - loadFixture resets the EVM state for each test
    // Tests will handle time progression as needed

    // Initial feed prices set to the latest values
    const btcLatest = btcPrices[btcPrices.length - 1];
    const ethLatest = ethPrices[ethPrices.length - 1];

    const btcFeed = await MockV3Aggregator.deploy(8, btcLatest);
    const ethFeed = await MockV3Aggregator.deploy(8, ethLatest);
    const day = 24 * 60 * 60;

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
        btcData: last200Dates.map((d, i) => ({ timestamp: startTimestamp + (i * day), price: Number(btcByDate.get(d)) })),
        ethData: last200Dates.map((d, i) => ({ timestamp: startTimestamp + (i * day), price: Number(ethByDate.get(d)) })),
        startTimestamp,
        day
    };
}


export async function deployDeterministicSep28Fixture() {
    const [owner] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockERC20");
    const wbtc = await MockToken.deploy("Wrapped Bitcoin", "WBTC");
    const weth = await MockToken.deploy("Wrapped Ether", "WETH");

    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");

    const btcPath = path.resolve(__dirname, "../config/btc_daily.json");
    const ethPath = path.resolve(__dirname, "../config/eth_daily.json");
    const btcJson = JSON.parse(fs.readFileSync(btcPath, "utf8")) as { date: string; close: number; }[];
    const ethJson = JSON.parse(fs.readFileSync(ethPath, "utf8")) as { date: string; close: number; }[];

    const btcByDate = new Map<string, number>(btcJson.map(r => [r.date, r.close]));
    const ethByDate = new Map<string, number>(ethJson.map(r => [r.date, r.close]));

    const cutoff = "2025-09-28";
    const commonDates = Array.from(btcByDate.keys())
        .filter(d => ethByDate.has(d) && d <= cutoff)
        .sort();

    const last200Dates = commonDates.slice(-200);

    const parseUtcMidnight = (ymd: string): number => {
        const [year, month, day] = ymd.split("-").map(Number);
        return Date.UTC(year, month - 1, day) / 1000;
    };

    const startTimestamp = parseUtcMidnight(last200Dates[0]);
    const btcPrices = last200Dates.map(d => ethers.parseUnits(btcByDate.get(d)!.toString(), 8));
    const ethPrices = last200Dates.map(d => ethers.parseUnits(ethByDate.get(d)!.toString(), 8));
    const btcTimestamps = ethers.getBigInt(startTimestamp);
    const ethTimestamps = ethers.getBigInt(startTimestamp);

    const btcLatest = btcPrices[btcPrices.length - 1];
    const ethLatest = ethPrices[ethPrices.length - 1];

    const btcFeed = await MockV3Aggregator.deploy(8, btcLatest);
    const ethFeed = await MockV3Aggregator.deploy(8, ethLatest);
    const day = 24 * 60 * 60;

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
        btcData: last200Dates.map((d, i) => ({ timestamp: startTimestamp + (i * day), price: Number(btcByDate.get(d)) })),
        ethData: last200Dates.map((d, i) => ({ timestamp: startTimestamp + (i * day), price: Number(ethByDate.get(d)) })),
        startTimestamp,
        day
    };
}


