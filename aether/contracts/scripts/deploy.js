require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying AetherCarbon with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MATIC");

  const aiSignerAddress = process.env.AI_SIGNER_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS;

  if (!aiSignerAddress || !treasuryAddress) {
    throw new Error(
      "AI_SIGNER_ADDRESS and TREASURY_ADDRESS must be set in .env"
    );
  }

  console.log("\nDeploying with parameters:");
  console.log("  AI Signer Address:", aiSignerAddress);
  console.log("  Treasury Address: ", treasuryAddress);

  const AetherCarbon = await hre.ethers.getContractFactory("AetherCarbon");
  const contract = await AetherCarbon.deploy(aiSignerAddress, treasuryAddress);

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ AetherCarbon deployed to:", address);
  console.log("\n📋 Copy these values to your .env files:");
  console.log(`   contracts/.env    → CONTRACT_ADDRESS=${address}`);
  console.log(`   backend/.env      → CONTRACT_ADDRESS=${address}`);
  console.log(`   frontend/.env.local → NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(
    `   frontend/.env.local → NEXT_PUBLIC_CHAIN_ID=80002`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
