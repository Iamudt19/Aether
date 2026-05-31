import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/api-utils";

function isVerifiedWalletTransaction(txHash?: string | null) {
  return typeof txHash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(txHash);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sellerAddress: string }> }
) {
  try {
    const { sellerAddress } = await params;
    const { data, error } = await supabaseAdmin
      .from("carbon_listings")
      .select("*")
      .eq("seller_address", sellerAddress.toLowerCase())
      .eq("status", "active")
      .not("token_id", "is", null)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    const verified = (data || []).filter(
      (l) => l.token_id !== null && isVerifiedWalletTransaction(l.tx_hash)
    );
    
    return NextResponse.json({ success: true, listings: verified });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
