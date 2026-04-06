const { Wallet } = require('ethers');

const deployer = Wallet.createRandom();
const aiSigner = Wallet.createRandom();
const treasury = Wallet.createRandom();

console.log(JSON.stringify({
  deployerPK: deployer.privateKey,
  deployerAddress: deployer.address,
  aiSignerPK: aiSigner.privateKey,
  aiSignerAddress: aiSigner.address,
  treasuryPK: treasury.privateKey,
  treasuryAddress: treasury.address
}));
