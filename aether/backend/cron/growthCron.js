require('dotenv').config();
const { ethers } = require('ethers');

// ABI fragment containing only the required admin methods for growth
const contractAbi = [
  "function totalMinted() external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenCredits(uint256 tokenId) external view returns (uint256)",
  "function updateCreditGrowth(uint256 tokenId, uint256 additionalCredits, string calldata newUri) external"
];

async function simulateGrowth() {
  console.log("🌲 Starting Aether Carbon Tree Growth Simulation Cron...");

  const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
  const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

  if (!DEPLOYER_PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.error("❌ DEPLOYER_PRIVATE_KEY or CONTRACT_ADDRESS not set in backend .env");
    process.exit(1);
  }

  // Connect to Sepolia network
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, signer);

  try {
    const total = await contract.totalMinted();
    console.log(`📊 Found total of ${total} minted carbon credit NFTs.`);

    if (total == 0n) {
      console.log("ℹ️ No active NFTs have been minted yet to simulate growth.");
      return;
    }

    // Evolve token ID 0 for demonstration purposes
    const tokenId = 0;
    const currentCredits = await contract.tokenCredits(tokenId);
    const owner = await contract.ownerOf(tokenId);

    console.log(`🌳 Tree NFT #${tokenId}:`);
    console.log(`   - Owner: ${owner}`);
    console.log(`   - Current Credits: ${currentCredits} kg CO₂`);

    const additionalCredits = 15; // Simulate growing 15 kg more of CO2 absorption
    const newMetadataUri = `ipfs://QmEvolvedTreeStatePlaceholder${Date.now()}`;

    console.log(`⚡ Sending contract transaction to upgrade credit capacity...`);
    const tx = await contract.updateCreditGrowth(tokenId, additionalCredits, newMetadataUri);
    console.log(`⏳ Waiting for transaction confirmation (Hash: ${tx.hash})...`);
    await tx.wait();

    console.log(`✅ Success! NFT #${tokenId} evolved to ${Number(currentCredits) + additionalCredits} kg CO₂.`);
  } catch (error) {
    console.error("❌ Growth simulation transaction failed:", error.message);
  }
}

simulateGrowth();
