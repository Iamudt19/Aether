require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");
const FormData = require("form-data");

// ─── Supabase Admin Client ────────────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// ─── Wallet Setup ─────────────────────────────────────────────────────────────

const AI_SIGNER_PRIVATE_KEY = process.env.AI_SIGNER_PRIVATE_KEY;
if (!AI_SIGNER_PRIVATE_KEY) {
  console.error("❌  AI_SIGNER_PRIVATE_KEY not set in .env");
  process.exit(1);
}
const aiSigner = new ethers.Wallet(AI_SIGNER_PRIVATE_KEY);
console.log(`✅  AI Signer Address: ${aiSigner.address}`);

// ─── Plant.id & Pinata Services ───────────────────────────────────────────────

function isTree(plantName, commonNames = [], taxonomy = {}) {
  const name = plantName.toLowerCase();
  
  // 1. List of known tree genera (scientific name starts with these or taxonomy genus matches)
  const treeGenera = [
    "ficus", "mangifera", "azadirachta", "moringa", "cocos", "phoenix", "quercus", "acer", "pinus",
    "betula", "fraxinus", "ulmus", "salix", "populus", "eucalyptus", "cedrus", "picea", "abies",
    "cupressus", "sequoia", "prunus", "malus", "citrus", "olea", "platanus", "acacia", "adansonia",
    "bambusa", "castanea", "fagus", "tilia", "juglans", "carya", "pyrus", "swietenia", "cedrela",
    "tectona", "dalbergia", "shorea", "pterocarpus", "santol", "alstonia", "jacaranda", "delonix",
    "albizia", "cassia", "erythrina", "bauhinia", "peltophorum", "spathodea", "tabebuia"
  ];
  
  const genus = taxonomy?.genus?.toLowerCase() || name.split(" ")[0];
  if (treeGenera.includes(genus)) {
    return true;
  }
  
  // 2. Keywords in common names or scientific name that identify trees
  const treeKeywords = [
    "tree", "palm", "pine", "oak", "maple", "birch", "willow", "cypress", "spruce", "fir", "cedar",
    "redwood", "fig", "neem", "moringa", "mango", "bamboo", "ash", "elm", "beech", "walnut", "chestnut",
    "poplar", "eucalyptus", "baobab", "larch", "hemlock", "juniper", "yew", "alder", "magnolia", "cherry",
    "peach", "plum", "apple", "pear", "orange", "lemon", "lime", "avocado", "olive", "jacaranda",
    "banyan", "gulmohar", "mahogany", "teak", "rosewood", "sal tree", "peepal", "sacred fig"
  ];
  
  // Check scientific name
  if (treeKeywords.some(keyword => name.includes(keyword))) {
    return true;
  }
  
  // Check common names
  if (commonNames.some(cn => {
    const cnLower = cn.toLowerCase();
    return treeKeywords.some(keyword => cnLower.includes(keyword));
  })) {
    return true;
  }
  
  return false;
}

async function identifyPlant(base64Image) {
  const PLANT_ID_API_KEY = process.env.PLANT_ID_API_KEY;
  if (!PLANT_ID_API_KEY) throw new Error("Missing Plant.id API key");
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  console.log(`🔬  Calling Plant.id API (image size: ${Math.round(base64Data.length / 1024)}KB base64)...`);
  const res = await axios.post("https://api.plant.id/v2/identify", {
    images: [base64Data],
    modifiers: ["similar_images"],
    plant_details: ["common_names", "taxonomy"],
  }, {
    headers: { "Api-Key": PLANT_ID_API_KEY },
    timeout: 30000,
  });
  const data = res.data;
  console.log(`🔬  Plant.id Response → is_plant: ${data.is_plant}, probability: ${data.is_plant_probability}`);
  const isPlant = data.is_plant !== undefined ? data.is_plant : true;
  const isPlantProbability = data.is_plant_probability !== undefined ? data.is_plant_probability : (isPlant ? 0.95 : 0.1);
  const isValidPlant = isPlant && isPlantProbability >= 0.5;
  if (data.suggestions && data.suggestions.length > 0) {
    const top = data.suggestions[0];
    return { 
      is_plant: isPlant, 
      is_plant_probability: isPlantProbability, 
      species: isValidPlant ? (top.plant_name || "Unknown") : "Non-Plant Object", 
      probability: isValidPlant ? (top.probability || 0) : 0.0,
      common_names: top.plant_details?.common_names || [],
      taxonomy: top.plant_details?.taxonomy || {},
    };
  }
  return { is_plant: isPlant, is_plant_probability: isPlantProbability, species: "Unknown", probability: 0, common_names: [], taxonomy: {} };
}

// Google Vision removed from backend.


async function uploadImageToPinata(base64Image) {
  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) return "ipfs://QmMockImagePlaceholder";
  try {
    const formData = new FormData();
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    formData.append("file", buffer, { filename: "proof.jpg", contentType: "image/jpeg" });
    const res = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
      headers: { ...formData.getHeaders(), Authorization: `Bearer ${PINATA_JWT}` }
    });
    return `ipfs://${res.data.IpfsHash}`;
  } catch(err) {
    console.error("Pinata image upload failed:", err.message);
    return "ipfs://QmFallbackProofPlaceholder";
  }
}

async function uploadMetadataToPinata(metadata) {
  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) return `ipfs://QmPlaceholder${Date.now()}`;
  try {
    const res = await axios.post("https://api.pinata.cloud/pinning/pinJSONToIPFS", metadata, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${PINATA_JWT}` },
    });
    return `ipfs://${res.data.IpfsHash}`;
  } catch (err) {
    console.error("Pinata metadata upload failed:", err.message);
    return `ipfs://QmFallback${Date.now()}`;
  }
}

function getAllocationMatrix(score) {
  if (score >= 0.98) return { credits: 60, band: "Elite" };
  if (score >= 0.97) return { credits: 50, band: "Premium" };
  if (score >= 0.96) return { credits: 40, band: "Strong" };
  if (score >= 0.95) return { credits: 30, band: "Standard" };
  return null;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/verify
 * Body: { lat, lng, imageBase64, userAddress }
 */
app.post("/api/verify", async (req, res) => {
  try {
    const { lat, lng, imageBase64, userAddress } = req.body;
    if (!userAddress || !imageBase64) return res.status(400).json({ error: "imageBase64 and userAddress are required" });
    if (!ethers.isAddress(userAddress)) return res.status(400).json({ error: "Invalid Ethereum address" });
    console.log(`🌳  Received verification from ${userAddress}`);

    // 1. Plant.id Taxonomy Verification
    let plantResult = {
      is_plant: true,
      is_plant_probability: 0.5,
      species: "Generic Flora",
      probability: 0.5,
      api_failed: false,
    };

    try {
      const result = await identifyPlant(imageBase64);
      plantResult = { ...result, api_failed: false };
      console.log(`🔎  Plant.id → Species: ${plantResult.species} | Confidence: ${(plantResult.probability * 100).toFixed(1)}%`);
    } catch (err) {
      console.warn("⚠️ Plant.id API failed.", err.message);
      plantResult.api_failed = true;
    }

    if (plantResult.api_failed) {
      return res.status(200).json({
        success: false,
        rejected: true,
        species: "Verification Service Unavailable",
        probability: 0,
        is_plant: false,
        is_plant_probability: 0,
        message: "Verification service is currently offline or the API limit is reached. Please try again later.",
      });
    }

    const isPlantProb = plantResult.is_plant_probability || 0;
    const taxonomyProb = plantResult.probability || 0;
    const combinedScore = (taxonomyProb * 0.7) + (isPlantProb * 0.3);
    const allocation = getAllocationMatrix(combinedScore);
    const isPlantTree = isTree(plantResult.species, plantResult.common_names, plantResult.taxonomy);

    if (!plantResult.is_plant || isPlantProb < 0.95 || taxonomyProb < 0.95 || combinedScore < 0.95 || !allocation || !isPlantTree) {
      console.warn(`🚫 Verification failed: plant check failed (isPlant=${plantResult.is_plant}, isPlantProb=${isPlantProb.toFixed(2)}, taxonomyProb=${taxonomyProb.toFixed(2)}, combined=${combinedScore.toFixed(2)}, isTree=${isPlantTree})`);
      
      const rejectMessage = !isPlantTree 
        ? `Visual verification failed: Identified object (${plantResult.species}) is not classified as a valid tree species. Please capture a clear, high-resolution photo of a real tree outdoors.`
        : "Visual verification failed: only clearly verified tree species can receive carbon offset credits. Please upload a clear photo of your tree outdoors.";

      return res.status(200).json({
        success: false,
        rejected: true,
        species: plantResult.species || "Non-Tree Object",
        probability: taxonomyProb,
        is_plant: plantResult.is_plant,
        is_plant_probability: isPlantProb,
        verification_score: combinedScore,
        showConfidence: false,
        message: rejectMessage
      });
    }

    const species = plantResult.species;
    const confidence = combinedScore;
    const creditAmount = allocation.credits;

    const imageIPFSHash = await uploadImageToPinata(imageBase64);
    console.log(`🖼️  Image uploaded: ${imageIPFSHash}`);

    const metadata = {
      name: `Aether Active Credit #${Date.now()}`,
      description: `AI identified species: ${species} with ${(confidence * 100).toFixed(1)}% confidence.`,
      image: imageIPFSHash,
      attributes: [
        { trait_type: "Latitude", value: lat ? lat.toFixed(4) : "Unknown" },
        { trait_type: "Longitude", value: lng ? lng.toFixed(4) : "Unknown" },
        { trait_type: "Species", value: species },
        { trait_type: "AI Confidence", value: `${(confidence * 100).toFixed(1)}%` },
        { trait_type: "CO2 Offset (kg)", value: creditAmount },
        { trait_type: "Allocation Band", value: allocation.band },
        { trait_type: "Verification Method", value: "Ground-Level Photo + Plant.id" },
        { trait_type: "Verified At", value: new Date().toISOString() },
      ],
    };

    const tokenURI = await uploadMetadataToPinata(metadata);
    console.log(`📌  Metadata uploaded: ${tokenURI}`);

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "string", "string"],
      [userAddress, creditAmount, species, imageIPFSHash]
    );
    const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));
    console.log(`✍️  Signed mint for ${userAddress} | Credits: ${creditAmount}`);

    // Store listing in Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_URL.includes("supabase.co")) {
      const { error } = await supabaseAdmin.from("carbon_listings").insert({
        seller_address: userAddress.toLowerCase(),
        species,
        credits: creditAmount,
        price_inr: creditAmount * 10,
        tx_hash: signature.slice(0, 42),
        status: "pending",
        lat: lat || null,
        lng: lng || null,
        image_url: imageIPFSHash,
        created_at: new Date().toISOString(),
      });
      if (error) console.warn("⚠️ Listing insert failed:", error.message);
      else console.log(`✅ Listing stored for: ${userAddress}`);
    }

    return res.status(200).json({
      success: true,
      species,
      probability: confidence,
      verification_score: combinedScore,
      showConfidence: true,
      allocationBand: allocation.band,
      credits: creditAmount,
      imageIPFSHash,
      tokenURI,
      signature,
      signerAddress: aiSigner.address,
      message: `Verified ${species} (${(confidence * 100).toFixed(1)}% confidence) → ${creditAmount} kg CO₂ credits.`,
    });
  } catch (err) {
    console.error("Error in /api/verify:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Direct Database Management Endpoints (Bypassing Client-side RLS) ───────

/**
 * POST /api/listings/confirm
 * Body: { txHash, userAddress, signature }
 */
app.post("/api/listings/confirm", async (req, res) => {
  try {
    const { txHash, userAddress } = req.body;
    if (!userAddress) return res.status(400).json({ error: "userAddress is required" });
    
    // Find latest listing without a token_id for this seller
    const { data: listings, error: fetchErr } = await supabaseAdmin
      .from("carbon_listings")
      .select("id")
      .eq("seller_address", userAddress.toLowerCase())
      .is("token_id", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchErr || !listings || listings.length === 0) {
      console.warn("⚠️ No unconfirmed listing found for:", userAddress);
      return res.status(200).json({ success: false, message: "No unconfirmed listing found." });
    }

    const listingId = listings[0].id;

    // Count already confirmed listings to assign a unique incremental token ID
    const { count, error: countErr } = await supabaseAdmin
      .from("carbon_listings")
      .select("*", { count: 'exact', head: true })
      .not("token_id", "is", null);

    const newTokenId = countErr ? Math.floor(Math.random() * 900) + 100 : (count + 1);

    const { error: updateErr } = await supabaseAdmin
      .from("carbon_listings")
      .update({
        token_id: newTokenId,
        tx_hash: txHash, status: "active",
      })
      .eq("id", listingId);

    if (updateErr) throw updateErr;

    console.log(`✅ Listing ${listingId} confirmed with Token ID #${newTokenId}`);
    return res.status(200).json({ success: true, tokenId: newTokenId });
  } catch (err) {
    console.error("Error in /api/listings/confirm:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/listings/buy
 * Body: { txHash, tokenId, buyerAddress, userSessionId }
 */
app.post("/api/listings/buy", async (req, res) => {
  try {
    const { txHash, tokenId, buyerAddress, userSessionId } = req.body;
    console.log(`🛒  Processing purchase for Token #${tokenId} by ${buyerAddress}`);

    // Update listing status to sold
    const { data: listing, error: updateErr } = await supabaseAdmin
      .from("carbon_listings")
      .update({ status: "sold" })
      .eq("token_id", tokenId)
      .select()
      .single();

    if (updateErr) {
      console.error("⚠️ Failed to update listing to sold:", updateErr.message);
      return res.status(400).json({ error: "Failed to update listing to sold" });
    }

    // Insert purchase record for the buyer log
    const { error: insertErr } = await supabaseAdmin
      .from("carbon_purchases")
      .insert({
        payment_id: txHash,
        order_id: `order_${Date.now()}`,
        amount_inr: listing.price_inr,
        credits_kg: listing.credits,
        status: "captured",
        user_id: userSessionId || null,
        species: listing.species,
        created_at: new Date().toISOString(),
      });

    if (insertErr) {
      console.error("⚠️ Failed to insert purchase record:", insertErr.message);
    } else {
      console.log(`✅ Purchase logged in database for buyer ${buyerAddress}`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in /api/listings/buy:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/listings
 * Body: { tokenId, userAddress }
 */
app.delete("/api/listings", async (req, res) => {
  try {
    const { tokenId, userAddress } = req.body;
    console.log(`❌  Cancelling listing for Token #${tokenId} by ${userAddress}`);

    const { error } = await supabaseAdmin
      .from("carbon_listings")
      .update({ status: "inactive" })
      .eq("token_id", tokenId)
      .eq("seller_address", userAddress.toLowerCase());

    if (error) {
      console.error("⚠️ Failed to deactivate listing:", error.message);
      return res.status(400).json({ error: "Failed to deactivate listing" });
    }

    console.log(`✅  Listing for Token #${tokenId} deactivated successfully.`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in DELETE /api/listings:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Data API Endpoints ───────────────────────────────────────────────────────

/** GET /api/purchases/:userId */
app.get("/api/purchases/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const { data, error } = await supabaseAdmin.from("carbon_purchases").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, purchases: data || [] });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

function isVerifiedWalletTransaction(txHash) {
  return typeof txHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(txHash);
}

/** GET /api/listings */
app.get("/api/listings", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("carbon_listings")
      .select("*")
      .eq("status", "active")
      .not("token_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
      
    if (error) return res.status(500).json({ error: error.message });
    
    const verified = (data || []).filter(
      (l) => l.token_id !== null && isVerifiedWalletTransaction(l.tx_hash)
    );
    
    return res.status(200).json({ success: true, listings: verified });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /api/listings/:sellerAddress */
app.get("/api/listings/:sellerAddress", async (req, res) => {
  try {
    const { sellerAddress } = req.params;
    const { data, error } = await supabaseAdmin
      .from("carbon_listings")
      .select("*")
      .eq("seller_address", sellerAddress.toLowerCase())
      .eq("status", "active")
      .not("token_id", "is", null)
      .order("created_at", { ascending: false });
      
    if (error) return res.status(500).json({ error: error.message });
    
    const verified = (data || []).filter(
      (l) => l.token_id !== null && isVerifiedWalletTransaction(l.tx_hash)
    );
    
    return res.status(200).json({ success: true, listings: verified });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /api/health */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", signerAddress: aiSigner.address, timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🌿  Aether Backend running on http://localhost:${PORT}`);
});

module.exports = app;
