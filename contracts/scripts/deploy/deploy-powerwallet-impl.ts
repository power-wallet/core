import { ethers, run, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying PowerWallet implementation to ${network.name} with deployer: ${deployer.address}`);

  const PowerWallet = await ethers.getContractFactory("PowerWallet");
  const powerWallet = await PowerWallet.deploy(deployer.address);
  await powerWallet.waitForDeployment();

  const addr = await powerWallet.getAddress();
  console.log("PowerWallet implementation deployed at:", addr);

  // Optional verify step (best-effort)
  try {
    console.log("Verifying on explorer...");
    await run("verify:verify", {
      address: addr,
      constructorArguments: [deployer.address],
    });
    console.log("Verification submitted.");
  } catch (e: any) {
    console.log("Verification skipped/failed:", e?.message || e);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});


