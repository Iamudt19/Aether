const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = ethers;

describe("AetherCarbon", function () {
  let contract;
  let owner, aiSigner, treasury, seller, buyer, stranger;

  beforeEach(async () => {
    [owner, aiSigner, treasury, seller, buyer, stranger] =
      await ethers.getSigners();

    const AetherCarbon = await ethers.getContractFactory("AetherCarbon");
    contract = await AetherCarbon.deploy(
      aiSigner.address,
      treasury.address
    );
    await contract.waitForDeployment();
  });

  // ─── Helper ──────────────────────────────────────────────────────────────

  async function signMint(signerWallet, userAddress, creditAmount, species = "Oak", imageHash = "ipfs://Qmabc") {
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "string", "string"],
      [userAddress, creditAmount, species, imageHash]
    );
    // Sign with the Ethereum prefix
    return signerWallet.signMessage(ethers.getBytes(messageHash));
  }

  async function mintToken(user, creditAmount = 10, species = "Oak", imageHash = "ipfs://Qmabc", uri = "ipfs://Qmtest") {
    const sig = await signMint(aiSigner, user.address, creditAmount, species, imageHash);
    return contract.connect(user).mintWithSignature(creditAmount, species, imageHash, uri, sig);
  }

  // ─── Minting ─────────────────────────────────────────────────────────────

  describe("mintWithSignature", () => {
    it("mints a token with a valid AI signer signature", async () => {
      await expect(mintToken(seller)).to.emit(contract, "CarbonCreditMinted");
      expect(await contract.ownerOf(0)).to.equal(seller.address);
      expect(await contract.tokenCredits(0)).to.equal(10);
    });

    it("stores correct token URI", async () => {
      await mintToken(seller, 10, "Oak", "ipfs://Qmabc", "ipfs://QmTestHash");
      expect(await contract.tokenURI(0)).to.equal("ipfs://QmTestHash");
    });

    it("reverts with invalid (stranger) signer", async () => {
      const badSig = await signMint(stranger, seller.address, 10);
      await expect(
        contract.connect(seller).mintWithSignature(10, "Oak", "ipfs://Qmabc", "ipfs://Qmtest", badSig)
      ).to.be.revertedWith("Invalid AI signer signature");
    });

    it("reverts on replay attack (reused signature)", async () => {
      await mintToken(seller);
      // Second mint attempt with same creditAmount should fail
      const sig = await signMint(aiSigner, seller.address, 10);
      await expect(
        contract.connect(seller).mintWithSignature(10, "Oak", "ipfs://Qmabc", "ipfs://Qmtest", sig)
      ).to.be.revertedWith("Signature already used");
    });

    it("reverts when creditAmount is 0", async () => {
      const sig = await signMint(aiSigner, seller.address, 0);
      await expect(
        contract.connect(seller).mintWithSignature(0, "Oak", "ipfs://Qmabc", "ipfs://Qmtest", sig)
      ).to.be.revertedWith("Credit amount must be > 0");
    });
  });

  // ─── Listing ─────────────────────────────────────────────────────────────

  describe("list", () => {
    beforeEach(async () => {
      await mintToken(seller);
      // Approve contract to transfer
      await contract.connect(seller).approve(await contract.getAddress(), 0);
    });

    it("lists a token for sale", async () => {
      await expect(
        contract.connect(seller).list(0, parseEther("1"))
      ).to.emit(contract, "TokenListed");

      const listing = await contract.getListing(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(parseEther("1"));
      expect(listing.active).to.be.true;
    });

    it("reverts if not the token owner", async () => {
      await expect(
        contract.connect(stranger).list(0, parseEther("1"))
      ).to.be.revertedWith("Not token owner");
    });

    it("reverts if price is 0", async () => {
      await expect(
        contract.connect(seller).list(0, 0)
      ).to.be.revertedWith("Price must be > 0");
    });
  });

  // ─── Buying ──────────────────────────────────────────────────────────────

  describe("buy", () => {
    const PRICE = parseEther("1");
    const FEE = (PRICE * 250n) / 10000n; // 2.5%
    const SELLER_PROCEEDS = PRICE - FEE;

    beforeEach(async () => {
      await mintToken(seller);
      await contract.connect(seller).approve(await contract.getAddress(), 0);
      await contract.connect(seller).list(0, PRICE);
    });

    it("transfers NFT and routes payments correctly", async () => {
      const sellerBefore = await ethers.provider.getBalance(seller.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await expect(
        contract.connect(buyer).buy(0, { value: PRICE })
      ).to.emit(contract, "TokenSold");

      // NFT transferred
      expect(await contract.ownerOf(0)).to.equal(buyer.address);

      // Listing deactivated
      const listing = await contract.getListing(0);
      expect(listing.active).to.be.false;

      // Treasury received 2.5%
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(FEE);

      // Seller received 97.5%
      const sellerAfter = await ethers.provider.getBalance(seller.address);
      expect(sellerAfter - sellerBefore).to.equal(SELLER_PROCEEDS);
    });

    it("refunds excess payment to buyer", async () => {
      const buyerBefore = await ethers.provider.getBalance(buyer.address);
      const overpay = parseEther("2");
      const tx = await contract.connect(buyer).buy(0, { value: overpay });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * tx.gasPrice;

      const buyerAfter = await ethers.provider.getBalance(buyer.address);
      // Buyer should have spent ~1 MATIC + gas (excess refunded)
      expect(buyerBefore - buyerAfter).to.be.closeTo(PRICE + gasCost, parseEther("0.001"));
    });

    it("reverts if token is not listed", async () => {
      await expect(
        contract.connect(buyer).buy(1, { value: PRICE })
      ).to.be.revertedWith("Token not listed for sale");
    });

    it("reverts if insufficient payment", async () => {
      await expect(
        contract.connect(buyer).buy(0, { value: parseEther("0.5") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("reverts if seller tries to buy own listing", async () => {
      await expect(
        contract.connect(seller).buy(0, { value: PRICE })
      ).to.be.revertedWith("Cannot buy your own listing");
    });
  });

  // ─── Cancel Listing ───────────────────────────────────────────────────────

  describe("cancelListing", () => {
    beforeEach(async () => {
      await mintToken(seller);
      await contract.connect(seller).approve(await contract.getAddress(), 0);
      await contract.connect(seller).list(0, parseEther("1"));
    });

    it("cancels an active listing", async () => {
      await expect(contract.connect(seller).cancelListing(0))
        .to.emit(contract, "ListingCancelled");
      expect((await contract.getListing(0)).active).to.be.false;
    });

    it("reverts if caller is not listing owner", async () => {
      await expect(
        contract.connect(stranger).cancelListing(0)
      ).to.be.revertedWith("Not listing owner");
    });
  });

  // ─── Admin ───────────────────────────────────────────────────────────────

  describe("admin", () => {
    it("owner can update backend address", async () => {
      await contract.connect(owner).setAuthorizedBackendAddress(stranger.address);
      expect(await contract.authorizedBackendAddress()).to.equal(stranger.address);
    });

    it("non-owner cannot update backend address", async () => {
      await expect(
        contract.connect(stranger).setAuthorizedBackendAddress(stranger.address)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("owner can update treasury wallet", async () => {
      await contract.connect(owner).setTreasuryWallet(stranger.address);
      expect(await contract.treasuryWallet()).to.equal(stranger.address);
    });
  });
});
