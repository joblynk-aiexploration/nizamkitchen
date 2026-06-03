import { NextResponse } from "next/server";
import { logError } from "@/server/observability/logger";
import { createSystemAlertForFailure } from "@/server/observability/system-alerts";
import { handleStripeWebhook } from "@/server/payments/providers/stripe/stripe-webhooks";

export async function handleStripeWebhookRequest(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  try {
    const result = await handleStripeWebhook({ rawBody, signature });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    logError("Stripe webhook route failed", error, { hasSignature: Boolean(signature) });
    await createSystemAlertForFailure({
      type: "stripe_webhook_route_failure",
      title: "Stripe webhook route failed",
      message: error instanceof Error ? error.message : "Stripe webhook could not be processed.",
      severity: "critical",
      metadataJson: { provider: "stripe", hasSignature: Boolean(signature) },
    });
    return NextResponse.json({ ok: false, error: "Stripe webhook could not be processed." }, { status: 400 });
  }
}
