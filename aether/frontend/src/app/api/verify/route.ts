import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  identifyPlant,
  uploadImageToPinata,
  uploadMetadataToPinata,
  getAISigner,
  supabaseAdmin,
  isTree,
} from "@/lib/api-utils";

function getAllocationMatrix(score: number) {
  if (score >= 0.98) return { credits: 60, band: "Elite" };
  if (score >= 0.97) return { credits: 50, band: "Premium" };
  if (score >= 0.96) return { credits: 40, band: "Strong" };
  if (score >= 0.95) return { credits: 30, band: "Standard" };
  return null;
}

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

    // ── Plant.id Verification ────────────────────────────────────────────────
    let plantResult = {
      is_plant: true,
      is_plant_probability: 0.5,
      species: "Generic Flora",
      probability: 0.5,
      api_failed: false,
      common_names: [] as string[],
      taxonomy: {} as any,
    };

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
        showConfidence: false,
        message: "Verification service is currently offline or the API limit is reached. Please try again later.",
      });
    }

    const isPlantProb = plantResult.is_plant_probability || 0;
    const taxonomyProb = plantResult.probability || 0;
    const verificationScore = (taxonomyProb * 0.7) + (isPlantProb * 0.3);
    const allocation = getAllocationMatrix(verificationScore);
    const isPlantTree = isTree(plantResult.species, plantResult.common_names, plantResult.taxonomy);

    if (!plantResult.is_plant || isPlantProb < 0.95 || taxonomyProb < 0.95 || verificationScore < 0.95 || !allocation || !isPlantTree) {
      console.warn(
        `🚫 Verification failed: isPlant=${plantResult.is_plant}, isPlantProb=${isPlantProb.toFixed(2)}, taxonomyProb=${taxonomyProb.toFixed(2)}, score=${verificationScore.toFixed(2)}, isTree=${isPlantTree}`
      );
      
      const rejectMessage = !isPlantTree 
        ? `Visual verification failed: Identified object (${plantResult.species}) is not classified as a valid tree species. Please capture a clear, high-resolution photo of a real tree outdoors.`
        : "Visual verification failed: only clearly verified tree species can receive carbon offset credits. Please upload a clear photo of your tree outdoors.";

      return NextResponse.json({
        success: false,
        rejected: true,
        species: plantResult.species || "Non-Tree Object",
        probability: taxonomyProb,
        is_plant: plantResult.is_plant,
        is_plant_probability: isPlantProb,
        verification_score: verificationScore,
        showConfidence: false,
        message: rejectMessage,
      });
    }

    const { species } = plantResult;
    const confidence = verificationScore;
    const creditAmount = allocation.credits;

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
        { trait_type: "Allocation Band", value: allocation.band },
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
      verification_score: verificationScore,
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
