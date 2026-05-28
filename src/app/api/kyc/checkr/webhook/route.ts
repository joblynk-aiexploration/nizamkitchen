import { NextResponse } from "next/server";
import { recordKycWebhook } from "@/server/kyc/kyc-service";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());
  const event = await recordKycWebhook("checkr_placeholder", { rawBody, headers });
  return NextResponse.json({ received: true, status: event.status });
}
