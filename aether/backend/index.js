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

async function detectImageLabels(base64Image) {
  const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;
  if (!GOOGLE_VISION_API_KEY) {
    console.warn("⚠️ GOOGLE_VISION_API_KEY not set, skipping scene label analysis.");
    return [];
  }
  try {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const res = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        requests: [
          {
            image: {
              content: base64Data,
            },
            features: [
              {
                type: "LABEL_DETECTION",
                maxResults: 15,
              },
            ],
          },
        ],
      },
      { timeout: 15000 }
    );
    const annotations = res.data?.responses?.[0]?.labelAnnotations || [];
    const labels = annotations.map((ann) => ann.description.toLowerCase());
    console.log("🔍 Google Vision Scene Labels:", labels);
    return labels;
  } catch (err) {
    console.error("❌ Google Vision label detection failed:", err.message);
    return [];
  }
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

    const bypassAntiFraud = process.env.BYPASS_ANTI_FRAUD === "true";
    console.log(`🛡️  Bypass anti-fraud flag: ${bypassAntiFraud}`);

    let plantResult = {
      is_plant: true,
      is_plant_probability: 0.5,
      species: "Generic Flora",
      probability: 0.5,
      api_failed: false,
    };

    if (!bypassAntiFraud) {
      // 1. Plant.id Taxonomy Verification
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

      if (!plantResult.is_plant || plantResult.is_plant_probability < 0.5) {
        return res.status(200).json({
          success: false,
          rejected: true,
          species: plantResult.species || "Non-Plant Object",
          probability: plantResult.probability,
          is_plant: plantResult.is_plant,
          is_plant_probability: plantResult.is_plant_probability,
          message: "Object identified is not a valid plant. Please upload a clear photo of your tree."
        });
      }
      if (plantResult.probability < 0.8) {
        return res.status(200).json({
          success: false,
          rejected: true,
          species: plantResult.species,
          probability: plantResult.probability,
          is_plant: plantResult.is_plant,
          is_plant_probability: plantResult.is_plant_probability,
          message: `AI confidence is too low (${(plantResult.probability * 100).toFixed(1)}%). Please upload a clearer photo.`
        });
      }

      // 2. Google Vision Scene Verification (Anti-Fraud)
      const labels = await detectImageLabels(imageBase64);
      if (labels.length > 0) {
        const natureKeywords = [
          "tree", "plant", "leaf", "trunk", "branch", "forest", "vegetation", "shrub", "flora", 
          "garden", "nature", "wood", "green", "botany", "houseplant", "aerial photography", 
          "grass", "herb", "flower"
        ];
        const hasNatureContext = labels.some((lbl) => natureKeywords.includes(lbl));

        const screenKeywords = [
          "screen", "monitor", "television", "display device", "mobile phone", "gadget", 
          "smartphone", "laptop", "computer", "electronics"
        ];
        const isScreenOrDevice = labels.some((lbl) => screenKeywords.includes(lbl));

        if (isScreenOrDevice) {
          console.warn("🚫 Anti-fraud alert: Detected screen or mobile device in upload.");
          return res.status(200).json({
            success: false,
            rejected: true,
            species: "Device Screen / Electronic Photo",
            probability: 0.99,
            is_plant: false,
            is_plant_probability: 0.0,
            message: "Visual verification rejected: You cannot upload photos of electronic screens or digital devices. Please capture a real, physical tree outdoors."
          });
        }

        if (!hasNatureContext) {
          console.warn("🚫 Anti-fraud alert: No tree, plant or nature labels detected in scene.");
          return res.status(200).json({
            success: false,
            rejected: true,
            species: "Non-Nature Subject",
            probability: 0.95,
            is_plant: false,
            is_plant_probability: 0.0,
            message: "Visual verification failed: The photo does not appear to contain a valid tree or plant species in a natural setting. Please upload a clear photo of your tree outdoors."
          });
        }
      }
    } else {
      const mockTrees = ["Moringa Oleifera", "Azadirachta Indica (Neem)", "Ficus Religiosa (Sacred Fig)", "Mangifera Indica (Mango)"];
      plantResult = {
        is_plant: true,
        is_plant_probability: 0.98,
        species: mockTrees[Math.floor(Math.random() * mockTrees.length)],
        probability: 0.95,
        api_failed: false,
      };
      console.log(`🛡️  Bypass active. Auto-generating tree species: ${plantResult.species}`);
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
        tx_hash: txHash,
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
