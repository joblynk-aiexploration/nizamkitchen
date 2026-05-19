import { NextResponse } from "next/server";
import { handlePayPalWebhook } from "@/server/payments/providers/paypal/paypal-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const result = await handlePayPalWebhook({ rawBody, headers: request.headers });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    console.error("[paypal-webhook] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "PayPal webhook could not be processed." }, { status: 400 });
  }
}
