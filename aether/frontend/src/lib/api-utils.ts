import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import axios from "axios";
import FormData from "form-data";

// ─── Supabase Admin Client ────────────────────────────────────────────────────
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY || ""
);

// ─── AI Signer ────────────────────────────────────────────────────────────────
let _aiSigner: ethers.Wallet | null = null;
export function getAISigner(): ethers.Wallet {
  if (!_aiSigner) {
    const key = process.env.AI_SIGNER_PRIVATE_KEY;
    if (!key) throw new Error("AI_SIGNER_PRIVATE_KEY not set");
    _aiSigner = new ethers.Wallet(key);
  }
  return _aiSigner;
}

// ─── Plant.id ─────────────────────────────────────────────────────────────────
export async function identifyPlant(base64Image: string) {
  const PLANT_ID_API_KEY = process.env.PLANT_ID_API_KEY;
  if (!PLANT_ID_API_KEY) throw new Error("Missing Plant.id API key");
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  const res = await axios.post(
    "https://api.plant.id/v2/identify",
    {
      images: [base64Data],
      modifiers: ["similar_images"],
      plant_details: ["common_names", "taxonomy"],
    },
    {
      headers: { "Api-Key": PLANT_ID_API_KEY },
      timeout: 30000,
    }
  );
  const data = res.data;
  const isPlant = data.is_plant !== undefined ? data.is_plant : true;
  const isPlantProbability =
    data.is_plant_probability !== undefined
      ? data.is_plant_probability
      : isPlant
      ? 0.95
      : 0.1;
  const isValidPlant = isPlant && isPlantProbability >= 0.5;

  if (data.suggestions && data.suggestions.length > 0) {
    const top = data.suggestions[0];
    return {
      is_plant: isPlant,
      is_plant_probability: isPlantProbability,
      species: isValidPlant ? (top.plant_name || "Unknown") : "Non-Plant Object",
      probability: isValidPlant ? (top.probability || 0) : isPlantProbability,
    };
  }
  return { is_plant: isPlant, is_plant_probability: isPlantProbability, species: "Unknown", probability: 0 };
}

// ─── Google Vision Label Detection ───────────────────────────────────────────
export async function detectImageLabels(base64Image: string): Promise<string[]> {
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
    const labels = annotations.map((ann: any) => ann.description.toLowerCase());
    console.log("🔍 Google Vision Scene Labels:", labels);
    return labels;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Google Vision label detection failed:", message);
    return [];
  }
}

// ─── Pinata ───────────────────────────────────────────────────────────────────
export async function uploadImageToPinata(base64Image: string): Promise<string> {
  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) return "ipfs://QmMockImagePlaceholder";
  try {
    const formData = new FormData();
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    formData.append("file", buffer, { filename: "proof.jpg", contentType: "image/jpeg" });
    const res = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      { headers: { ...formData.getHeaders(), Authorization: `Bearer ${PINATA_JWT}` } }
    );
    return `ipfs://${res.data.IpfsHash}`;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Pinata image upload failed:", message);
    return "ipfs://QmFallbackProofPlaceholder";
  }
}

export async function uploadMetadataToPinata(metadata: object): Promise<string> {
  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) return `ipfs://QmPlaceholder${Date.now()}`;
  try {
    const res = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      metadata,
      { headers: { "Content-Type": "application/json", Authorization: `Bearer ${PINATA_JWT}` } }
    );
    return `ipfs://${res.data.IpfsHash}`;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Pinata metadata upload failed:", message);
    return `ipfs://QmFallback${Date.now()}`;
  }
}
