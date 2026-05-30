import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/api-utils";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("carbon_listings")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, listings: data || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { tokenId, userAddress, txHash } = await req.json();

    if (tokenId === undefined || !userAddress) {
      return NextResponse.json(
        { error: "tokenId and userAddress are required" },
        { status: 400 }
      );
    }

    console.log(`🗑️ Cancelling listing for Token #${tokenId} by ${userAddress} | Tx: ${txHash || "N/A"}`);

    const { error } = await supabaseAdmin
      .from("carbon_listings")
      .update({ status: "cancelled", tx_hash: txHash || null })
      .eq("token_id", parseInt(tokenId))
      .eq("seller_address", userAddress.toLowerCase());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tokenId, status: "cancelled" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
