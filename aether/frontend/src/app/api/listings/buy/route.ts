import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const { txHash, tokenId, buyerAddress, userSessionId } = await req.json();

    if (!txHash || tokenId === undefined || !buyerAddress) {
      return NextResponse.json(
        { error: "txHash, tokenId, and buyerAddress are required" },
        { status: 400 }
      );
    }

    console.log(`🛒 Recording purchase of Token #${tokenId} by ${buyerAddress} | Tx: ${txHash}`);

    // 1. Fetch the existing listing details to get species and credits
    const { data: listing, error: fetchError } = await supabaseAdmin
      .from("carbon_listings")
      .select("*")
      .eq("token_id", parseInt(tokenId))
      .limit(1)
      .single();

    if (fetchError || !listing) {
      return NextResponse.json({ error: "Carbon listing not found in database" }, { status: 404 });
    }

    // 2. Update status to 'sold' in carbon_listings
    const { error: updateError } = await supabaseAdmin
      .from("carbon_listings")
      .update({ status: "sold" })
      .eq("token_id", parseInt(tokenId));

    if (updateError) throw updateError;

    // 3. Record in carbon_purchases for the buyer
    const { error: purchaseError } = await supabaseAdmin.from("carbon_purchases").insert({
      payment_id: txHash,
      order_id: `token_id_${tokenId}`,
      amount_inr: listing.price_inr || listing.credits * 10,
      credits_kg: listing.credits,
      status: "captured",
      user_id: userSessionId || null,
      species: listing.species,
      created_at: new Date().toISOString(),
    });

    if (purchaseError) {
      console.warn("⚠️ Failed to insert purchase record in database:", purchaseError.message);
    }

    console.log(`✅ Trade confirmed in database. Token #${tokenId} marked as sold.`);
    return NextResponse.json({ success: true, tokenId, status: "sold" });
  } catch (err: any) {
    console.error("Error in /api/listings/buy:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
