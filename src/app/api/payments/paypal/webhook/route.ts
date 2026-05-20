import { NextResponse } from "next/server";
import { logError } from "@/server/observability/logger";
import { createSystemAlertForFailure } from "@/server/observability/system-alerts";
import { handlePayPalWebhook } from "@/server/payments/providers/paypal/paypal-webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const result = await handlePayPalWebhook({ rawBody, headers: request.headers });
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    logError("PayPal webhook route failed", error, { hasTransmissionId: Boolean(request.headers.get("paypal-transmission-id")) });
    await createSystemAlertForFailure({
      type: "paypal_webhook_route_failure",
      title: "PayPal webhook route failed",
      message: error instanceof Error ? error.message : "PayPal webhook could not be processed.",
      severity: "critical",
      metadataJson: { provider: "paypal", hasTransmissionId: Boolean(request.headers.get("paypal-transmission-id")) },
    });
    return NextResponse.json({ ok: false, error: "PayPal webhook could not be processed." }, { status: 400 });
  }
}
