import { ethers, upgrades, network } from "hardhat";

// Proxy addresses for each network
const PROXY_ADDRESSES: { [key: string]: string } = {
  "base": "",      // TODO: Add Base mainnet proxy address after deployment
  "base-sepolia": "0x7A0F3B371A2563627EfE1967E7645812909Eb6c5",
  "sepolia": ""    // TODO: Add Sepolia proxy address after deployment
};

async function main() {
  const networkName = network.name;
  const proxyAddress = PROXY_ADDRESSES[networkName];

  if (!proxyAddress) {
    throw new Error(`No proxy address configured for network ${networkName}`);
  }

  console.log(`Upgrading TechnicalIndicators on ${networkName}...`);
  console.log("Proxy address:", proxyAddress);

  // Get the new implementation contract factory
  const TechnicalIndicators = await ethers.getContractFactory("TechnicalIndicators");
  
  // Perform the upgrade
  console.log("Deploying new implementation...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, TechnicalIndicators);
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("New implementation address:", newImplAddress);

  // Verify on block explorer if not on local network
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for 5 block confirmations before verification...");
    await ethers.provider.waitForTransaction(
      upgraded.deploymentTransaction()?.hash || "",
      5
    );
    
    console.log("Verifying new implementation contract...");
    try {
      await run("verify:verify", {
        address: newImplAddress,
        constructorArguments: []
      });
    } catch (error) {
      console.log("Verification failed:", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
