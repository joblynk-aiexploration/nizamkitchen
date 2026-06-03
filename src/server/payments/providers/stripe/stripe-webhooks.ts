import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { generateAccountingForPaymentOrder } from "@/server/accounting/accounting-service";
import { createSystemAlertForFailure } from "@/server/observability/system-alerts";
import { createAdminNotification } from "@/server/notifications/notification-service";
import { notifyPaymentSucceeded } from "@/server/payments/payment-confirmation";
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
    await createSystemAlertForFailure({
      type: "stripe_webhook_failure",
      title: "Stripe webhook processing failed",
      message: error instanceof Error ? error.message : "Unknown Stripe webhook error",
      severity: "critical",
      metadataJson: { eventId: event.id, eventType: event.type, provider: "stripe" },
    });
    return { status: "failed" as const, eventId: event.id };
  }
}

async function processStripeEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentOrderId = session.metadata?.paymentOrderId;
    const subscriptionPaid = session.mode !== "subscription" || session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (paymentOrderId && subscriptionPaid) {
      await markPaymentOrderPaid(paymentOrderId, {
        providerCheckoutSessionId: session.id,
        providerPaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
        providerCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
      });
    }
    if (session.mode === "subscription" && session.metadata?.billingSubscriptionId && subscriptionPaid) {
      await activateBillingSubscriptionFromStripe({
        billingSubscriptionId: session.metadata.billingSubscriptionId,
        providerCustomerId: stripeObjectId(session.customer),
        providerSubscriptionId: stripeObjectId(session.subscription),
      });
    }
    return;
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const metadata = invoiceSubscriptionMetadata(invoice);
    const providerSubscriptionId = invoiceSubscriptionId(invoice);
    const billingSubscription = metadata.billingSubscriptionId
      ? await prisma.billingSubscription.findUnique({ where: { id: metadata.billingSubscriptionId } })
      : providerSubscriptionId
        ? await prisma.billingSubscription.findFirst({ where: { providerSubscriptionId } })
        : null;
    const paymentOrderId = metadata.paymentOrderId ?? billingSubscription?.paymentOrderId ?? null;

    if (paymentOrderId) {
      await markPaymentOrderPaid(paymentOrderId, {
        providerPaymentIntentId: invoicePaymentIntentId(invoice) ?? undefined,
        providerCustomerId: stripeObjectId(invoice.customer) ?? undefined,
      });
    }

    const billingSubscriptionId = metadata.billingSubscriptionId ?? billingSubscription?.id ?? null;
    if (billingSubscriptionId) {
      await activateBillingSubscriptionFromStripe({
        billingSubscriptionId,
        providerCustomerId: stripeObjectId(invoice.customer),
        providerSubscriptionId,
        currentPeriodStart: stripeDate(invoicePeriodStart(invoice)),
        currentPeriodEnd: stripeDate(invoicePeriodEnd(invoice)),
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

  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentOrder = dispute.payment_intent
      ? await prisma.paymentOrder.findFirst({ where: { providerPaymentIntentId: typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent.id } })
      : null;
    await prisma.paymentDispute.upsert({
      where: { provider_providerDisputeId: { provider: "stripe", providerDisputeId: dispute.id } },
      update: {
        status: "needs_response",
        amount: dispute.amount ? new Prisma.Decimal(dispute.amount / 100) : null,
        currencyCode: dispute.currency?.toUpperCase() ?? null,
        reason: dispute.reason ?? null,
        rawJson: dispute as unknown as Prisma.InputJsonValue,
      },
      create: {
        paymentOrderId: paymentOrder?.id ?? null,
        organizationId: paymentOrder?.organizationId ?? null,
        provider: "stripe",
        providerDisputeId: dispute.id,
        status: "needs_response",
        amount: dispute.amount ? new Prisma.Decimal(dispute.amount / 100) : null,
        currencyCode: dispute.currency?.toUpperCase() ?? null,
        reason: dispute.reason ?? null,
        evidenceDueBy: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : null,
        rawJson: dispute as unknown as Prisma.InputJsonValue,
      },
    });
    await createAuditEvent({ action: "payment_dispute.created", targetType: "payment_dispute", targetId: dispute.id, organizationId: paymentOrder?.organizationId ?? null, countryCode: paymentOrder?.countryCode ?? null });
    await createAdminNotification({
      organizationId: paymentOrder?.organizationId ?? null,
      countryCode: paymentOrder?.countryCode ?? null,
      type: "payment_dispute_opened",
      title: "Payment dispute opened",
      body: `Stripe dispute ${dispute.id} requires admin review.`,
      actionUrl: "/admin/payments/disputes",
      priority: "urgent",
    });
    return;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    await prisma.billingSubscription.updateMany({
      where: { providerSubscriptionId: subscription.id },
      data: {
        status: mapStripeSubscriptionStatus(subscription.status),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: stripeDate((subscription as unknown as { current_period_start?: number | null }).current_period_start),
        currentPeriodEnd: stripeDate((subscription as unknown as { current_period_end?: number | null }).current_period_end),
      },
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
  const existing = await prisma.paymentOrder.findUnique({ where: { id: paymentOrderId } });
  if (existing?.status === "paid") return existing;

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
  if (order.module === "subscription") {
    await prisma.billingSubscription.updateMany({
      where: { id: order.moduleEntityId },
      data: { status: "active", currentPeriodStart: order.paidAt ?? new Date(), provider: "stripe" },
    });
  }
  await createAuditEvent({ action: "payment_order.paid", targetType: "payment_order", targetId: order.id, organizationId: order.organizationId, countryCode: order.countryCode });
  await generateAccountingForPaymentOrder(order.id).catch((error) => {
    console.error("Unable to generate accounting records for paid order", error);
  });
  await notifyPaymentSucceeded(order).catch((error) => {
    console.error("Unable to send payment success notifications", error);
  });

  return order;
}

async function activateBillingSubscriptionFromStripe(params: {
  billingSubscriptionId: string;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}) {
  await prisma.billingSubscription.update({
    where: { id: params.billingSubscriptionId },
    data: {
      provider: "stripe",
      status: "active",
      ...(params.providerCustomerId ? { providerCustomerId: params.providerCustomerId } : {}),
      ...(params.providerSubscriptionId ? { providerSubscriptionId: params.providerSubscriptionId } : {}),
      ...(params.currentPeriodStart ? { currentPeriodStart: params.currentPeriodStart } : {}),
      ...(params.currentPeriodEnd ? { currentPeriodEnd: params.currentPeriodEnd } : {}),
    },
  });
}

function stripeObjectId(value: string | { id?: string | null } | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function invoiceSubscriptionMetadata(invoice: Stripe.Invoice) {
  const extended = invoice as unknown as {
    metadata?: Record<string, string> | null;
    subscription_details?: { metadata?: Record<string, string> | null } | null;
    parent?: { subscription_details?: { metadata?: Record<string, string> | null } | null } | null;
  };
  return {
    ...(extended.metadata ?? {}),
    ...(extended.subscription_details?.metadata ?? {}),
    ...(extended.parent?.subscription_details?.metadata ?? {}),
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const extended = invoice as unknown as {
    subscription?: string | { id?: string | null } | null;
    parent?: { subscription_details?: { subscription?: string | { id?: string | null } | null } | null } | null;
  };
  return stripeObjectId(extended.subscription ?? extended.parent?.subscription_details?.subscription);
}

function invoicePaymentIntentId(invoice: Stripe.Invoice) {
  const extended = invoice as unknown as { payment_intent?: string | { id?: string | null } | null };
  return stripeObjectId(extended.payment_intent);
}

function invoicePeriodStart(invoice: Stripe.Invoice) {
  const extended = invoice as unknown as { period_start?: number | null; lines?: { data?: Array<{ period?: { start?: number | null } | null }> } | null };
  return extended.period_start ?? extended.lines?.data?.[0]?.period?.start ?? null;
}

function invoicePeriodEnd(invoice: Stripe.Invoice) {
  const extended = invoice as unknown as { period_end?: number | null; lines?: { data?: Array<{ period?: { end?: number | null } | null }> } | null };
  return extended.period_end ?? extended.lines?.data?.[0]?.period?.end ?? null;
}

function stripeDate(timestamp?: number | null) {
  return timestamp ? new Date(timestamp * 1000) : null;
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  return "cancelled";
}
