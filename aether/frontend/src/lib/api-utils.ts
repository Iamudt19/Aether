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

export function isTree(plantName: string, commonNames: string[] = [], taxonomy: any = {}): boolean {
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
      probability: isValidPlant ? (top.probability || 0) : 0.0,
      common_names: top.plant_details?.common_names || [],
      taxonomy: top.plant_details?.taxonomy || {},
    };
  }
  return { is_plant: isPlant, is_plant_probability: isPlantProbability, species: "Unknown", probability: 0, common_names: [], taxonomy: {} };
}

// Google Vision removed: detectImageLabels function deleted.

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
