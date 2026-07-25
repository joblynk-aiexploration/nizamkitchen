import { handleStripeWebhookRequest } from "@/server/payments/providers/stripe/stripe-webhook-route";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleStripeWebhookRequest(request);
}
