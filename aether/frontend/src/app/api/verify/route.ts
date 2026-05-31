import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  identifyPlant,
  detectImageLabels,
  uploadImageToPinata,
  uploadMetadataToPinata,
  getAISigner,
  supabaseAdmin,
} from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const { lat, lng, imageBase64, userAddress } = await req.json();

    if (!userAddress || !imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 and userAddress are required" },
        { status: 400 }
      );
    }
    if (!ethers.isAddress(userAddress)) {
      return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 });
    }

    console.log(`🌳  Received verification from ${userAddress}`);

    const bypassAntiFraud = process.env.BYPASS_ANTI_FRAUD === "true";
    console.log(`🛡️  Bypass anti-fraud flag: ${bypassAntiFraud}`);

    // ── Visual Verification (Dual-Layer AI check) ────────────────────────────
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
        console.log(
          `🔎  Plant.id → Species: ${plantResult.species} | Confidence: ${(plantResult.probability * 100).toFixed(1)}%`
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.warn("⚠️ Plant.id API failed.", message);
        plantResult.api_failed = true;
      }

      if (plantResult.api_failed) {
        return NextResponse.json({
          success: false,
          rejected: true,
          species: "Verification Service Unavailable",
          probability: 0,
          is_plant: false,
          is_plant_probability: 0,
          message: "Verification service is currently offline or the API limit is reached. Please try again later.",
        });
      }
      // Stronger verification matrix on frontend as well
      const isPlantProb = plantResult.is_plant_probability || 0;
      const taxonomyProb = plantResult.probability || 0;
      const combinedScore = (taxonomyProb * 0.7) + (isPlantProb * 0.3);
      if (plantResult.api_failed || !plantResult.is_plant || isPlantProb < 0.75 || taxonomyProb < 0.85 || combinedScore < 0.85) {
        return NextResponse.json({
          success: false,
          rejected: true,
          species: plantResult.species || "Non-Plant Object",
          probability: taxonomyProb,
          is_plant: plantResult.is_plant,
          is_plant_probability: isPlantProb,
          verification_score: combinedScore,
          message: "Visual verification failed: AI confidence is insufficient or object is not a verified plant. Please upload a clear photo of your tree outdoors.",
        });
      }

      // 2. Google Vision Scene Verification (Anti-Fraud)
      const vision = await detectImageLabels(imageBase64);
      const labels = vision.labels || [];
      const imageProperties = vision.imageProperties || null;

      if (labels.length === 0) {
        console.warn("🚫 Anti-fraud alert: No scene labels detected in image.");
        return NextResponse.json({
          success: false,
          rejected: true,
          species: "Unverifiable Scene",
          probability: 0.0,
          is_plant: false,
          is_plant_probability: 0.0,
          message: "Visual verification failed: The image could not be analyzed for scene content. Please upload a clear, well-lit photo of your tree outdoors.",
        });
      }

      // basic mostly-dark check using Vision's dominant colors
      if (imageProperties && imageProperties.dominantColors && imageProperties.dominantColors.colors) {
        const colors = imageProperties.dominantColors.colors as any[];
        let darkFraction = 0;
        for (const c of colors) {
          const col = c.color || { red: 0, green: 0, blue: 0 };
          const r = col.red || 0, g = col.green || 0, b = col.blue || 0;
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (luminance < 20) darkFraction += (c.pixelFraction || 0);
        }
        if (darkFraction >= 0.85) {
          console.warn("🚫 Anti-fraud alert: Image appears to be mostly dark/blank.");
          return NextResponse.json({
            success: false,
            rejected: true,
            species: "Blank / Dark Image",
            probability: 0.0,
            is_plant: false,
            is_plant_probability: 0.0,
            message: "Visual verification failed: The image appears to be blank or too dark to analyze. Please upload a clear, well-lit photo of your tree outdoors.",
          });
        }
      }

      if (labels.length > 0) {
        // Enforce tree/plant/nature context: At least one of these should be present
        const natureKeywords = [
          "tree", "plant", "leaf", "trunk", "branch", "forest", "vegetation", "shrub", "flora", 
          "garden", "nature", "wood", "green", "botany", "houseplant", "aerial photography", 
          "grass", "herb", "flower"
        ];
        const hasNatureContext = labels.some((lbl) => natureKeywords.includes(lbl));

        // Reject screens, monitors, mobile phones, electronics, laptops, indoor offices
        const screenKeywords = [
          "screen", "monitor", "television", "display device", "mobile phone", "gadget", 
          "smartphone", "laptop", "computer", "electronics"
        ];
        const isScreenOrDevice = labels.some((lbl) => screenKeywords.includes(lbl));

        if (isScreenOrDevice) {
          console.warn("🚫 Anti-fraud alert: Detected screen or mobile device in upload.");
          return NextResponse.json({
            success: false,
            rejected: true,
            species: "Device Screen / Electronic Photo",
            probability: 0.0,
            is_plant: false,
            is_plant_probability: 0.0,
            message: "Visual verification rejected: You cannot upload photos of electronic screens or digital devices. Please capture a real, physical tree outdoors.",
          });
        }

        if (!hasNatureContext) {
          console.warn("🚫 Anti-fraud alert: No tree, plant or nature labels detected in scene.");
          return NextResponse.json({
            success: false,
            rejected: true,
            species: "Non-Nature Subject",
            probability: 0.0,
            is_plant: false,
            is_plant_probability: 0.0,
            message: "Visual verification failed: The photo does not appear to contain a valid tree or plant species in a natural setting. Please upload a clear photo of your tree outdoors.",
          });
        }
      }
    } else {
      // Bypassed! Generate a random realistic tree species
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

    const { species, probability: confidence } = plantResult;
    const estimatedHeight = Math.random() * (5 - 2) + 2;
    const creditAmount = Math.floor(estimatedHeight * 0.5 * 3.67 * 10);

    // ── Pinata Uploads ────────────────────────────────────────────────────────
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

    // ── AI Signing ────────────────────────────────────────────────────────────
    const aiSigner = getAISigner();
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "string", "string"],
      [userAddress, creditAmount, species, imageIPFSHash]
    );
    const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));
    console.log(`✍️  Signed mint for ${userAddress} | Credits: ${creditAmount}`);

    // ── Store Listing in Supabase ─────────────────────────────────────────────
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (supabaseUrl.includes("supabase.co")) {
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

    return NextResponse.json({
      success: true,
      species,
      probability: confidence,
      credits: creditAmount,
      imageIPFSHash,
      tokenURI,
      signature,
      signerAddress: aiSigner.address,
      message: `Verified ${species} (${(confidence * 100).toFixed(1)}% confidence) → ${creditAmount} kg CO₂ credits.`,
    });
  } catch (err) {
    console.error("Error in /api/verify:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
