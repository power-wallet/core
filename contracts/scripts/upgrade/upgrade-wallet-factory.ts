import { ethers, upgrades, network } from "hardhat";

// Option A: set FACTORY_PROXY_ADDR env var
// Option B: fill the mapping below per network
const PROXY_ADDRESSES: { [key: string]: string } = {
  "base": "",
  "base-sepolia": "0x6e6A4C1094a064030c30607549BF8d87311cB219",
  "sepolia": "",
};

async function main() {
  const proxyAddress = process.env.FACTORY_PROXY_ADDR || PROXY_ADDRESSES[network.name];
  if (!proxyAddress) {
    throw new Error(`Set FACTORY_PROXY_ADDR or PROXY_ADDRESSES for network ${network.name}`);
  }

  console.log(`Upgrading WalletFactory on ${network.name}...`);
  console.log("Proxy address:", proxyAddress);

  const WalletFactory = await ethers.getContractFactory("WalletFactory");

  // Read current implementation before upgrade
  const implBefore = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Current implementation:", implBefore);

  // Optional: slight fee bump helper
  const fee = await ethers.provider.getFeeData();
  const pri = (fee.maxPriorityFeePerGas ?? ethers.parseUnits("1", "gwei")) + ethers.parseUnits("1", "gwei");
  const max = (fee.maxFeePerGas ?? ethers.parseUnits("10", "gwei")) + ethers.parseUnits("2", "gwei");

  console.log("Deploying new implementation & performing upgrade...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, WalletFactory, {
    kind: "uups",
    txOverrides: { maxPriorityFeePerGas: pri, maxFeePerGas: max },
  });
  await upgraded.waitForDeployment();

  // Poll EIP-1967 slot until it reflects the new implementation
  let newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  if (newImplAddress.toLowerCase() === implBefore.toLowerCase()) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      if (newImplAddress.toLowerCase() !== implBefore.toLowerCase()) break;
    }
  }
  console.log("New implementation address:", newImplAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


