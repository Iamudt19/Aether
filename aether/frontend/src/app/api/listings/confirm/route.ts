import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { supabaseAdmin } from "@/lib/api-utils";
import { contractAddress } from "@/lib/constants";

// ERC-721 Transfer Event signature topic
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export async function POST(req: NextRequest) {
  try {
    const { txHash, userAddress, signature } = await req.json();

    if (!txHash || !userAddress || !signature) {
      return NextResponse.json(
        { error: "txHash, userAddress, and signature are required" },
        { status: 400 }
      );
    }

    console.log(`📡 Confirming mint transaction: ${txHash} for ${userAddress}`);

    // Initialize provider
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Wait for receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return NextResponse.json({ error: "Transaction receipt not found yet" }, { status: 404 });
    }

    if (receipt.status !== 1) {
      return NextResponse.json({ error: "On-chain transaction failed" }, { status: 400 });
    }

    // Extract tokenId from Transfer event log
    const transferLog = receipt.logs.find(
      (log) => log.topics[0].toLowerCase() === TRANSFER_EVENT_TOPIC.toLowerCase()
    );

    if (!transferLog) {
      return NextResponse.json({ error: "Transfer event not found in logs" }, { status: 400 });
    }

    // In ERC721 Transfer(from, to, tokenId), tokenId is indexed, so it's topics[3]
    const tokenIdHex = transferLog.topics[3];
    if (!tokenIdHex) {
      return NextResponse.json({ error: "Token ID not found in topics" }, { status: 400 });
    }

    const tokenId = BigInt(tokenIdHex).toString();
    console.log(`🌳 Found Token ID: ${tokenId} from Transfer logs`);

    // Match signature substring (which was stored temporarily as tx_hash) to update the record
    const tempSigHash = signature.slice(0, 42);

    // Find and update the carbon listing record
    const { data: matched, error: findError } = await supabaseAdmin
      .from("carbon_listings")
      .select("*")
      .eq("seller_address", userAddress.toLowerCase())
      .eq("tx_hash", tempSigHash)
      .limit(1);

    if (findError || !matched || matched.length === 0) {
      console.warn("⚠️ No pending listing matched temporary signature, updating by newest entry instead");
      
      // Fallback: match by newest pending listing for the user
      const { data: newest, error: newestError } = await supabaseAdmin
        .from("carbon_listings")
        .select("*")
        .eq("seller_address", userAddress.toLowerCase())
        .is("token_id", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (newestError || !newest || newest.length === 0) {
        return NextResponse.json({ error: "Listing record not found in database" }, { status: 404 });
      }
      
      const { error: updateError } = await supabaseAdmin
        .from("carbon_listings")
        .update({
          token_id: parseInt(tokenId),
          tx_hash: txHash,
          status: "active"
        })
        .eq("id", newest[0].id);

      if (updateError) throw updateError;
    } else {
      // Update matched entry
      const { error: updateError } = await supabaseAdmin
        .from("carbon_listings")
        .update({
          token_id: parseInt(tokenId),
          tx_hash: txHash,
          status: "active"
        })
        .eq("id", matched[0].id);

      if (updateError) throw updateError;
    }

    console.log(`✅ Successfully confirmed tree mint. Token #${tokenId} active on map!`);
    return NextResponse.json({ success: true, tokenId, txHash });
  } catch (err: any) {
    console.error("Error in /api/listings/confirm:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
