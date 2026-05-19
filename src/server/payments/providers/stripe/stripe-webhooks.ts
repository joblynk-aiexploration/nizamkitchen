import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { createStripeClient, getStripeGateway, getStripeSecrets } from "@/server/payments/providers/stripe/stripe-client";

export async function constructStripeWebhookEvent(params: { rawBody: string; signature?: string | null; gatewayId?: string | null }) {
  const gateway = await getStripeGateway(params.gatewayId);
  const secrets = getStripeSecrets(gateway);
  if (!secrets.webhookSecret) throw new Error("Stripe webhook secret is not configured.");
  if (!params.signature) throw new Error("Stripe signature header is required.");
  const stripe = createStripeClient(secrets.secretKey);
  return { gateway, event: stripe.webhooks.constructEvent(params.rawBody, params.signature, secrets.webhookSecret) };
}

export async function handleStripeWebhook(params: { rawBody: string; signature?: string | null; gatewayId?: string | null }) {
  const { gateway, event } = await constructStripeWebhookEvent(params);
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { provider_eventId: { provider: "stripe", eventId: event.id } } });
  if (existing?.status === "processed") return { status: "ignored" as const, eventId: event.id };

  await prisma.paymentWebhookEvent.upsert({
    where: { provider_eventId: { provider: "stripe", eventId: event.id } },
    update: { status: "received", rawJson: event as unknown as Prisma.InputJsonValue, signatureValid: true, errorMessage: null },
    create: {
      provider: "stripe",
      gatewayId: gateway.id,
      eventId: event.id,
      eventType: event.type,
      status: "received",
      rawJson: event as unknown as Prisma.InputJsonValue,
      signatureValid: true,
    },
  });

  try {
    await processStripeEvent(event);
    await prisma.paymentWebhookEvent.update({
      where: { provider_eventId: { provider: "stripe", eventId: event.id } },
      data: { status: "processed", processedAt: new Date() },
    });
    await createAuditEvent({ action: "payment_webhook.processed", targetType: "payment_webhook", targetId: event.id, details: { eventType: event.type } });
    return { status: "processed" as const, eventId: event.id };
  } catch (error) {
    await prisma.paymentWebhookEvent.update({
      where: { provider_eventId: { provider: "stripe", eventId: event.id } },
      data: { status: "failed", errorMessage: error instanceof Error ? error.message : "Unknown Stripe webhook error" },
    });
    await createAuditEvent({ action: "payment_webhook.failed", targetType: "payment_webhook", targetId: event.id, details: { eventType: event.type } });
    throw error;
  }
}

async function processStripeEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentOrderId = session.metadata?.paymentOrderId;
    if (paymentOrderId) {
      await markPaymentOrderPaid(paymentOrderId, {
        providerCheckoutSessionId: session.id,
        providerPaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
        providerCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      });
    }
    if (session.mode === "subscription" && session.metadata?.billingSubscriptionId) {
      await prisma.billingSubscription.update({
        where: { id: session.metadata.billingSubscriptionId },
        data: {
          provider: "stripe",
          providerCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
          providerSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
          status: "active",
        },
      });
    }
    return;
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.paymentOrderId) {
      await prisma.paymentOrder.update({ where: { id: session.metadata.paymentOrderId }, data: { status: "expired" } });
    }
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const paymentOrderId = intent.metadata?.paymentOrderId;
    if (paymentOrderId) await markPaymentOrderPaid(paymentOrderId, { providerPaymentIntentId: intent.id });
    return;
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    if (intent.metadata?.paymentOrderId) {
      await prisma.paymentOrder.update({
        where: { id: intent.metadata.paymentOrderId },
        data: { status: "failed", failureMessage: intent.last_payment_error?.message ?? null, failureCode: intent.last_payment_error?.code ?? null },
      });
    }
    return;
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentOrderId = charge.metadata?.paymentOrderId;
    if (paymentOrderId) {
      await prisma.paymentOrder.update({ where: { id: paymentOrderId }, data: { status: charge.amount_refunded === charge.amount ? "refunded" : "partially_refunded" } });
    }
    return;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    await prisma.billingSubscription.updateMany({
      where: { providerSubscriptionId: subscription.id },
      data: { status: mapStripeSubscriptionStatus(subscription.status), cancelAtPeriodEnd: subscription.cancel_at_period_end },
    });
    return;
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    await prisma.sellerPayoutAccount.updateMany({
      where: { provider: "stripe", providerAccountId: account.id },
      data: {
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
        status: account.charges_enabled && account.payouts_enabled ? "active" : account.details_submitted ? "pending" : "restricted",
      },
    });
  }
}

async function markPaymentOrderPaid(paymentOrderId: string, providerIds: { providerCheckoutSessionId?: string; providerPaymentIntentId?: string; providerCustomerId?: string }) {
  const order = await prisma.paymentOrder.update({
    where: { id: paymentOrderId },
    data: { status: "paid", paidAt: new Date(), ...providerIds },
  });
  await prisma.paymentTransaction.create({
    data: {
      paymentOrderId,
      organizationId: order.organizationId,
      provider: "stripe",
      gatewayId: order.gatewayId,
      transactionType: "charge",
      status: "succeeded",
      amount: order.amount,
      currencyCode: order.currencyCode,
      providerTransactionId: providerIds.providerPaymentIntentId ?? providerIds.providerCheckoutSessionId,
    },
  });
  await prisma.foodOrder.updateMany({ where: { paymentOrderId }, data: { paymentStatus: "paid", paidAt: new Date() } });
  await prisma.homeChefRequest.updateMany({ where: { paymentOrderId }, data: { paymentStatus: "paid", paidAt: new Date() } });
  await createAuditEvent({ action: "payment_order.paid", targetType: "payment_order", targetId: order.id, organizationId: order.organizationId, countryCode: order.countryCode });
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  return "cancelled";
}
