import { NextResponse } from "next/server";
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
