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
  if (data.suggestions && data.suggestions.length > 0) {
    const top = data.suggestions[0];
    return { is_plant: isPlant, is_plant_probability: isPlantProbability, species: top.plant_name || "Unknown", probability: top.probability || 0 };
  }
  return { is_plant: isPlant, is_plant_probability: isPlantProbability, species: "Unknown", probability: 0 };
}

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

    let plantResult = { is_plant: true, is_plant_probability: 0.5, species: "Generic Flora", probability: 0.5 };
    try {
      plantResult = await identifyPlant(imageBase64);
      console.log(`🔎  Plant.id → Species: ${plantResult.species} | Confidence: ${(plantResult.probability * 100).toFixed(1)}%`);
    } catch (err) {
      console.warn("⚠️ Plant.id API failed, using fallback.", err.message);
    }

    if (!plantResult.is_plant || plantResult.is_plant_probability < 0.5) {
      return res.status(200).json({ success: false, rejected: true, species: plantResult.species || "Non-Plant Object", probability: plantResult.probability, is_plant: plantResult.is_plant, is_plant_probability: plantResult.is_plant_probability, message: "Object identified is not a valid plant. Please upload a clear photo of your tree." });
    }
    if (plantResult.probability < 0.8) {
      return res.status(200).json({ success: false, rejected: true, species: plantResult.species, probability: plantResult.probability, is_plant: plantResult.is_plant, is_plant_probability: plantResult.is_plant_probability, message: `AI confidence is too low (${(plantResult.probability * 100).toFixed(1)}%). Please upload a clearer photo.` });
    }

    const species = plantResult.species;
    const confidence = plantResult.probability;
    const estimatedHeight = Math.random() * (5 - 2) + 2;
    const creditAmount = Math.floor(estimatedHeight * 0.5 * 3.67 * 10);

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
        status: "active",
        lat: lat || null,
        lng: lng || null,
        image_url: imageIPFSHash,
        created_at: new Date().toISOString(),
      });
      if (error) console.warn("⚠️ Listing insert failed:", error.message);
      else console.log(`✅ Listing stored for: ${userAddress}`);
    }

    return res.status(200).json({
      success: true, species, probability: confidence, credits: creditAmount,
      imageIPFSHash, tokenURI, signature, signerAddress: aiSigner.address,
      message: `Verified ${species} (${(confidence * 100).toFixed(1)}% confidence) → ${creditAmount} kg CO₂ credits.`,
    });
  } catch (err) {
    console.error("Error in /api/verify:", err);
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

/** GET /api/listings */
app.get("/api/listings", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("carbon_listings").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(100);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, listings: data || [] });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /api/listings/:sellerAddress */
app.get("/api/listings/:sellerAddress", async (req, res) => {
  try {
    const { sellerAddress } = req.params;
    const { data, error } = await supabaseAdmin.from("carbon_listings").select("*").eq("seller_address", sellerAddress.toLowerCase()).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, listings: data || [] });
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
