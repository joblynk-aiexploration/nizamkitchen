import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { createSystemAlertForFailure } from "@/server/observability/system-alerts";
import { getPayPalAccessToken, getPayPalGateway, getPayPalSecrets, paypalApiBase, paypalFetch } from "@/server/payments/providers/paypal/paypal-client";

type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    status?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
  };
};

export async function validatePayPalWebhook(params: { rawBody: string; headers: Headers; gatewayId?: string | null }) {
  const gateway = await getPayPalGateway(params.gatewayId);
  const secrets = getPayPalSecrets(gateway);
  if (!secrets.webhookId) throw new Error("PayPal webhook ID is not configured.");
  const apiBase = paypalApiBase(gateway.environment);
  const accessToken = await getPayPalAccessToken({ apiBase, clientId: secrets.clientId, clientSecret: secrets.clientSecret });
  const body = {
    auth_algo: params.headers.get("paypal-auth-algo"),
    cert_url: params.headers.get("paypal-cert-url"),
    transmission_id: params.headers.get("paypal-transmission-id"),
    transmission_sig: params.headers.get("paypal-transmission-sig"),
    transmission_time: params.headers.get("paypal-transmission-time"),
    webhook_id: secrets.webhookId,
    webhook_event: JSON.parse(params.rawBody),
  };
  const result = await paypalFetch<{ verification_status?: string }>({ apiBase, accessToken, path: "/v1/notifications/verify-webhook-signature", method: "POST", body });
  return result.verification_status === "SUCCESS";
}

export async function handlePayPalWebhook(params: { rawBody: string; headers: Headers; gatewayId?: string | null }) {
  const event = JSON.parse(params.rawBody) as PayPalWebhookEvent;
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { provider_eventId: { provider: "paypal", eventId: event.id } } });
  if (existing?.status === "processed") return { status: "ignored" as const, eventId: event.id };
  const signatureValid = await validatePayPalWebhook(params);
  await prisma.paymentWebhookEvent.upsert({
    where: { provider_eventId: { provider: "paypal", eventId: event.id } },
    update: { status: "received", rawJson: event as unknown as Prisma.InputJsonValue, signatureValid, errorMessage: null },
    create: { provider: "paypal", gatewayId: params.gatewayId ?? null, eventId: event.id, eventType: event.event_type, status: "received", rawJson: event as unknown as Prisma.InputJsonValue, signatureValid },
  });
  try {
    if (!signatureValid) throw new Error("PayPal webhook signature verification failed.");
    await processPayPalEvent(event);
    await prisma.paymentWebhookEvent.update({ where: { provider_eventId: { provider: "paypal", eventId: event.id } }, data: { status: "processed", processedAt: new Date() } });
    await createAuditEvent({ action: "payment_webhook.processed", targetType: "payment_webhook", targetId: event.id, details: { provider: "paypal", eventType: event.event_type } });
    return { status: "processed" as const, eventId: event.id };
  } catch (error) {
    await prisma.paymentWebhookEvent.update({
      where: { provider_eventId: { provider: "paypal", eventId: event.id } },
      data: { status: "failed", errorMessage: error instanceof Error ? error.message : "Unknown PayPal webhook error" },
    });
    await createAuditEvent({ action: "payment_webhook.failed", targetType: "payment_webhook", targetId: event.id, details: { provider: "paypal", eventType: event.event_type } });
    await createSystemAlertForFailure({
      type: "paypal_webhook_failure",
      title: "PayPal webhook processing failed",
      message: error instanceof Error ? error.message : "Unknown PayPal webhook error",
      severity: "critical",
      metadataJson: { eventId: event.id, eventType: event.event_type, provider: "paypal" },
    });
    throw error;
  }
}

async function processPayPalEvent(event: PayPalWebhookEvent) {
  if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
    const providerOrderId = event.resource?.id;
    if (providerOrderId) {
      await prisma.paymentOrder.updateMany({
        where: { provider: "paypal", providerOrderId, status: { not: "paid" } },
        data: { status: "requires_action" },
      });
    }
    return;
  }

  if (event.event_type === "CHECKOUT.ORDER.COMPLETED" || event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const providerOrderId = event.resource?.supplementary_data?.related_ids?.order_id ?? event.resource?.id;
    if (providerOrderId) await markPayPalOrderPaid(providerOrderId, event.resource?.id);
  }
  if (event.event_type === "PAYMENT.CAPTURE.REFUNDED") {
    const providerOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
    if (providerOrderId) await prisma.paymentOrder.updateMany({ where: { provider: "paypal", providerOrderId }, data: { status: "refunded" } });
  }
}

export async function markPayPalOrderPaid(providerOrderId: string, providerTransactionId?: string) {
  const existing = await prisma.paymentOrder.findFirstOrThrow({ where: { providerOrderId } });
  const order = await prisma.paymentOrder.update({
    where: { id: existing.id },
    data: { status: "paid", paidAt: new Date() },
  });
  await prisma.paymentTransaction.create({
    data: {
      paymentOrderId: order.id,
      organizationId: order.organizationId,
      provider: "paypal",
      gatewayId: order.gatewayId,
      transactionType: "charge",
      status: "succeeded",
      amount: order.amount,
      currencyCode: order.currencyCode,
      providerTransactionId,
    },
  });
  await prisma.foodOrder.updateMany({ where: { paymentOrderId: order.id }, data: { paymentStatus: "paid", paidAt: new Date() } });
  await prisma.homeChefRequest.updateMany({ where: { paymentOrderId: order.id }, data: { paymentStatus: "paid", paidAt: new Date() } });
  await createAuditEvent({ action: "payment_order.paid", targetType: "payment_order", targetId: order.id, organizationId: order.organizationId, countryCode: order.countryCode, details: { provider: "paypal" } });
  return order;
}
