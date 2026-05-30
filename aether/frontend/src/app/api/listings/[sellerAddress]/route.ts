import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/api-utils";

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
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, listings: data || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
