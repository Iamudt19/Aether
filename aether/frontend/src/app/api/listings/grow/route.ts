import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  identifyPlant,
  detectImageLabels,
  uploadImageToPinata,
  uploadMetadataToPinata,
  supabaseAdmin,
} from "@/lib/api-utils";
import abi from "@/lib/abi.json";
import { contractAddress } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { tokenId, imageBase64, userAddress } = await req.json();

    if (tokenId === undefined || !imageBase64 || !userAddress) {
      return NextResponse.json(
        { error: "tokenId, imageBase64, and userAddress are required" },
        { status: 400 }
      );
    }

    console.log(`🌿 Received Growth Request for Token #${tokenId} from ${userAddress}`);

    // 1. Fetch current listing from Supabase to verify owner
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from("carbon_listings")
      .select("*")
      .eq("token_id", parseInt(tokenId))
      .eq("seller_address", userAddress.toLowerCase())
      .limit(1)
      .single();

    if (fetchError || !listing) {
      return NextResponse.json({ error: "Active listing not found for this wallet" }, { status: 404 });
    }

    const bypassAntiFraud = process.env.BYPASS_ANTI_FRAUD === "true";

    // 2. Visual Verification on new growth photo
    let plantResult = {
      is_plant: true,
      is_plant_probability: 0.9,
      species: listing.species,
      probability: 0.9,
      api_failed: false,
    };

    if (!bypassAntiFraud) {
      try {
        const result = await identifyPlant(imageBase64);
        plantResult = { ...result, api_failed: false };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.warn("⚠️ Plant.id API failed during growth verification.", message);
        plantResult.api_failed = true;
      }

      if (plantResult.api_failed) {
        return NextResponse.json({
          error: "Verification service is offline. Please try again later.",
        }, { status: 503 });
      }

      if (!plantResult.is_plant || plantResult.is_plant_probability < 0.5) {
        return NextResponse.json({
          error: "Object identified in photo is not a valid plant. Please upload a clear photo of your tree.",
        }, { status: 400 });
      }

      const vision = await detectImageLabels(imageBase64);
      const labels = vision.labels || [];
      const imageProperties = vision.imageProperties || null;

      if (labels.length === 0) {
        return NextResponse.json({
          error: "Visual verification failed: The image could not be analyzed for scene content. Please upload a clear, well-lit photo of your tree outdoors.",
        }, { status: 400 });
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
          return NextResponse.json({
            error: "Visual verification failed: The image appears to be blank or too dark to analyze. Please upload a clear, well-lit photo of your tree outdoors.",
          }, { status: 400 });
        }
      }

      if (labels.length > 0) {
        const screenKeywords = ["screen", "monitor", "television", "display device", "mobile phone", "gadget", "smartphone", "laptop", "computer"];
        const isScreenOrDevice = labels.some((lbl) => screenKeywords.includes(lbl));
        if (isScreenOrDevice) {
          return NextResponse.json({
            error: "Visual verification rejected: You cannot upload photos of electronic screens. Please capture a real, physical tree.",
          }, { status: 400 });
        }
      }
    }

    // Calculate additional credits (simulating growth carbon capture)
    // Between 5 and 15 kg CO2e
    const additionalCredits = Math.floor(Math.random() * (15 - 5) + 5);
    const newTotalCredits = (listing.credits || 0) + additionalCredits;

    // 3. Upload new image to Pinata IPFS
    const newImageIPFS = await uploadImageToPinata(imageBase64);
    console.log(`🖼️ New growth image uploaded: ${newImageIPFS}`);

    // 4. Construct new metadata reflecting growth
    const newMetadata = {
      name: `Aether Carbon Credit #${tokenId} (Evolved)`,
      description: `Evolved/grown tree. Updated species: ${plantResult.species}. Total carbon sequestered: ${newTotalCredits} kg CO₂.`,
      image: newImageIPFS,
      attributes: [
        { trait_type: "Latitude", value: listing.lat ? Number(listing.lat).toFixed(4) : "Unknown" },
        { trait_type: "Longitude", value: listing.lng ? Number(listing.lng).toFixed(4) : "Unknown" },
        { trait_type: "Species", value: plantResult.species },
        { trait_type: "CO2 Offset (kg)", value: newTotalCredits },
        { trait_type: "Evolved Growth Level", value: "Level 2 (Active Canopy)" },
        { trait_type: "Last Growth Verified At", value: new Date().toISOString() },
      ],
    };

    const newMetadataURI = await uploadMetadataToPinata(newMetadata);
    console.log(`📌 New growth metadata uploaded: ${newMetadataURI}`);

    // 5. Send on-chain transaction calling updateCreditGrowth using admin key
    const privateKey = process.env.AI_SIGNER_PRIVATE_KEY || process.env.MINTER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("AI Signer private key not set on server");
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`✍️ Initializing on-chain growth transaction for Token #${tokenId} | Signer: ${wallet.address}`);
    const contract = new ethers.Contract(contractAddress, abi, wallet);

    // Call updateCreditGrowth(uint256 tokenId, uint256 additionalCredits, string calldata newUri)
    const tx = await contract.updateCreditGrowth(
      BigInt(tokenId),
      BigInt(additionalCredits),
      newMetadataURI
    );

    console.log(`📡 Growth transaction broadcasted. Tx hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ On-chain transaction confirmed in block ${receipt.blockNumber}`);

    // 6. Update database record in Supabase
    const { error: updateError } = await supabaseAdmin
      .from("carbon_listings")
      .update({
        credits: newTotalCredits,
        price_inr: newTotalCredits * 10,
        image_url: newImageIPFS,
        tx_hash: tx.hash,
      })
      .eq("token_id", parseInt(tokenId));

    if (updateError) {
      console.error("⚠️ Failed to update growth in Supabase:", updateError.message);
    }

    console.log(`🌳 Evolution complete for Token #${tokenId}. Credits: ${listing.credits} → ${newTotalCredits} kg`);

    return NextResponse.json({
      success: true,
      tokenId,
      additionalCredits,
      newTotalCredits,
      newImageIPFS,
      txHash: tx.hash,
    });
  } catch (err: any) {
    console.error("Error in /api/listings/grow:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
