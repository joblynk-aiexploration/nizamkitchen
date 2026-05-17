import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "nizamkitchen",
    timestamp: new Date().toISOString(),
  });
}
