// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AetherCarbon
 * @notice ERC-721 Carbon Credit NFTs with AI-verified minting and an on-chain marketplace.
 * @dev Minting requires a cryptographic signature from the authorizedBackendAddress (AI signer).
 *      Marketplace collects a 2.5% fee routed to the treasury wallet on every sale.
 */
contract AetherCarbon is ERC721URIStorage, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice The address whose private key the AI backend uses to sign mint requests.
    address public authorizedBackendAddress;

    /// @notice Receives 2.5% of every marketplace sale.
    address public treasuryWallet;

    /// @notice Marketplace fee in basis points (250 = 2.5%).
    uint256 public constant FEE_BPS = 250;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Auto-incrementing token ID counter.
    uint256 private _nextTokenId;

    /// @notice Maps tokenId → carbon credits (in kg CO2e) the NFT represents.
    mapping(uint256 => uint256) public tokenCredits;

    /// @notice Tracks which (address, creditAmount) pairs have already been minted.
    mapping(bytes32 => bool) public usedSignatures;

    // ─── Marketplace ─────────────────────────────────────────────────────────

    struct Listing {
        address seller;
        uint256 price; // in wei (MATIC)
        bool active;
    }

    mapping(uint256 => Listing) public listings;

    // ─── Events ──────────────────────────────────────────────────────────────

    event CarbonCreditMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 creditAmount,
        string tokenURI
    );
    event TokenListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event TokenSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 fee
    );
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event BackendAddressUpdated(address indexed newAddress);
    event TreasuryUpdated(address indexed newTreasury);
    event CreditGrowthUpdated(uint256 indexed tokenId, uint256 newCreditAmount, string newUri);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        address _authorizedBackendAddress,
        address _treasuryWallet
    ) ERC721("Aether Carbon Credit", "AETH") Ownable(msg.sender) {
        require(_authorizedBackendAddress != address(0), "Invalid backend address");
        require(_treasuryWallet != address(0), "Invalid treasury address");
        authorizedBackendAddress = _authorizedBackendAddress;
        treasuryWallet = _treasuryWallet;
    }

    // ─── Minting ─────────────────────────────────────────────────────────────

    /**
     * @notice Mint a Carbon Credit NFT. Requires a valid signature from the AI backend.
     * @param creditAmount  Number of kg CO2e this NFT represents.
     * @param species       The identified species of the tree
     * @param imageIPFSHash The hash of the captured proof image
     * @param uri           IPFS URI for the NFT metadata (uploaded by backend via Pinata).
     * @param signature     ECDSA signature of keccak256(abi.encodePacked(msg.sender, creditAmount, species, imageIPFSHash))
     *                      signed by authorizedBackendAddress.
     */
    function mintWithSignature(
        uint256 creditAmount,
        string calldata species,
        string calldata imageIPFSHash,
        string calldata uri,
        bytes calldata signature
    ) external nonReentrant {
        require(creditAmount > 0, "Credit amount must be > 0");

        // Build the same hash the backend signed
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, creditAmount, species, imageIPFSHash));

        // Prevent replay attacks — each unique signature hash can only mint once
        require(!usedSignatures[messageHash], "Signature already used");

        // Recover signer from Ethereum-prefixed hash
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        require(signer == authorizedBackendAddress, "Invalid AI signer signature");

        // Mark signature as used
        usedSignatures[messageHash] = true;

        // Mint
        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        tokenCredits[tokenId] = creditAmount;

        emit CarbonCreditMinted(msg.sender, tokenId, creditAmount, uri);
    }

    // ─── Marketplace ─────────────────────────────────────────────────────────

    /**
     * @notice List an owned token for sale on the marketplace.
     * @param tokenId   The NFT to list.
     * @param price     Sale price in wei (MATIC).
     */
    function list(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(price > 0, "Price must be > 0");
        require(
            getApproved(tokenId) == address(this) || isApprovedForAll(msg.sender, address(this)),
            "Contract not approved to transfer token"
        );

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit TokenListed(tokenId, msg.sender, price);
    }

    /**
     * @notice Buy a listed token. Sends 2.5% fee to treasury, remainder to seller.
     * Aliased for compatibility with UI.
     * @param tokenId   The NFT to purchase.
     */
    function buy(uint256 tokenId) external payable {
        _tradeCredit(tokenId);
    }

    /**
     * @notice Trade a carbon credit NFT. Sends 2.5% fee to treasury, remainder to seller.
     * @param tokenId   The NFT to purchase.
     */
    function tradeCredit(uint256 tokenId) external payable {
        _tradeCredit(tokenId);
    }

    function _tradeCredit(uint256 tokenId) internal nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Token not listed for sale");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy your own listing");

        address seller = listing.seller;
        uint256 price = listing.price;

        // Mark inactive before transfers to prevent re-entrancy
        listing.active = false;

        // Calculate fee & seller proceeds
        uint256 fee = (price * FEE_BPS) / BPS_DENOMINATOR;
        uint256 sellerProceeds = price - fee;

        // Transfer NFT
        _transfer(seller, msg.sender, tokenId);

        // Pay treasury
        (bool feeSent, ) = payable(treasuryWallet).call{value: fee}("");
        require(feeSent, "Fee transfer failed");

        // Pay seller
        (bool proceedsSent, ) = payable(seller).call{value: sellerProceeds}("");
        require(proceedsSent, "Seller payment failed");

        // Refund excess payment
        if (msg.value > price) {
            (bool refundSent, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(refundSent, "Refund failed");
        }

        emit TokenSold(tokenId, seller, msg.sender, price, fee);
    }

    /**
     * @notice Cancel an active listing.
     * @param tokenId   The NFT listing to cancel.
     */
    function cancelListing(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Not listing owner");
        require(listings[tokenId].active, "Listing not active");
        listings[tokenId].active = false;
        emit ListingCancelled(tokenId, msg.sender);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    /// @notice Returns the total number of tokens minted.
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Returns full listing info for a token.
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Update the authorized AI signer address (owner only).
    function setAuthorizedBackendAddress(address newAddress) external onlyOwner {
        require(newAddress != address(0), "Invalid address");
        authorizedBackendAddress = newAddress;
        emit BackendAddressUpdated(newAddress);
    }

    /// @notice Update the treasury wallet (owner only).
    function setTreasuryWallet(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid address");
        treasuryWallet = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /**
     * @notice Allows the owner (AI backend) to programmatically upgrade the carbon credit count
     *         and update the NFT metadata URI as the tree grows over time.
     * @param tokenId            The ID of the growing tree NFT.
     * @param additionalCredits  The amount of additional credits to add.
     * @param newUri             The new metadata URI reflecting the evolved tree state.
     */
    function updateCreditGrowth(
        uint256 tokenId,
        uint256 additionalCredits,
        string calldata newUri
    ) external onlyOwner {
        require(ownerOf(tokenId) != address(0), "Token does not exist");
        require(additionalCredits > 0, "Additional credits must be > 0");

        tokenCredits[tokenId] += additionalCredits;
        _setTokenURI(tokenId, newUri);

        emit CreditGrowthUpdated(tokenId, tokenCredits[tokenId], newUri);
    }
}
