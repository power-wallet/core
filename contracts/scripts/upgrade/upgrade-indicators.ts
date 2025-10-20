import { ethers, upgrades, network, run } from "hardhat";
import { addresses } from "../../config/addresses";

async function main() {
  const networkName = network.name;
  const cfg = (addresses as any)[networkName];
  const proxyAddress = cfg?.technicalIndicators;

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

  // wait 5 secs
  await new Promise(resolve => setTimeout(resolve, 5000));

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("New implementation address:", newImplAddress);

  console.log("Waiting for 5 block confirmations before verification...");
  const tx = upgraded.deploymentTransaction();
  if (tx) {
    await tx.wait(5);
  }
  
  console.log("Verifying new implementation contract..." + newImplAddress);
  try {
    await run("verify:verify", {
      address: newImplAddress,
      constructorArguments: []
    });
  } catch (error) {
    console.log("Verification failed:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
