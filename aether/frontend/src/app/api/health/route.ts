import { NextResponse } from "next/server";
import { getAISigner } from "@/lib/api-utils";

export async function GET() {
  try {
    const signer = getAISigner();
    return NextResponse.json({
      status: "ok",
      signerAddress: signer.address,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
