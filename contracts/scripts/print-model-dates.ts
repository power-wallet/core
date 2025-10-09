import { ethers } from "hardhat";

function toUnix(dateStr: string): bigint {
  // Interpret date as UTC midnight per contract's daysSinceGenesis logic
  const ts = Date.parse(dateStr + 'T00:00:00Z');
  return BigInt(Math.floor(ts / 1000));
}

function daysSinceGenesis(ts: bigint): bigint {
  const genesis = 1230940800n; // 2009-01-03T00:00:00Z
  if (ts <= genesis) return 1n;
  return (ts - genesis) / 86400n;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("SmartBtcDca", deployer);
  const smart = await factory.deploy();

  // Website power-law parameters
  const A = Math.pow(10, -16.493);
  const n = 5.68;

  const inputs = [
    { label: "2011-03-08", date: "2011-03-08" },
    { label: "2012-04-07", date: "2012-04-07" },
    { label: "2013-11-21", date: "2013-11-21" },
    { label: "2016-04-29", date: "2016-04-29" },
    { label: "2019-12-24", date: "2019-12-24" },
    { label: "2025-06-15", date: "2025-06-15" },
    { label: "2025-10-09", date: "2025-10-09" },
    { label: "2033-08-30", date: "2033-08-30" },
    { label: "2045-12-18", date: "2045-12-18" },
  ];

  console.log("--- TypeScript reference ---");
  console.log("Date, d, ts_1e8, ts_USD");
  for (const { label, date } of inputs) {
    const ts = toUnix(date);
    const d = daysSinceGenesis(ts);
    // TypeScript reference using same formula
    const tsModel = A * Math.pow(Number(d), n);
    const tsModel1e8 = Math.round(tsModel * 1e8);
    const tsUsd = tsModel;
    console.log(`${label}, ${d.toString()}, ${tsModel1e8}, ${tsUsd.toFixed(2)}`);
  }
  console.log("");
  console.log("--- Contract model ---");
  console.log("");
  console.log("Date, d, contract_1e8, contract_USD");
  // Contract model
  for (const { label, date } of inputs) {
    const ts = toUnix(date);
    const d = daysSinceGenesis(ts);
    const model = await smart.modelPriceUSD_1e8.staticCall(d);
    const usd = Number(model) / 1e8;
    console.log(`${label}, ${d.toString()}, ${model.toString()}, ${usd.toFixed(2)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


