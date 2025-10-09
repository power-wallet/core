import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("SmartBtcDca", deployer);
  const smart = await factory.deploy();
  const d = 6123n; // 2025-10-09
  const model = await smart.modelPriceUSD_1e8.staticCall(d);
  console.log("d=", d.toString(), "modelPriceUSD_1e8=", model.toString());
  const dollars = Number(model) / 1e8;
  console.log("model price $", dollars.toFixed(2));
}

main().catch((e) => { console.error(e); process.exit(1); });


