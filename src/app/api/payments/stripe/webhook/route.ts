import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/server/payments/providers/stripe/stripe-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  try {
    const result = await handleStripeWebhook({ rawBody, signature });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    console.error("[stripe-webhook] failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Stripe webhook could not be processed." }, { status: 400 });
  }
}
