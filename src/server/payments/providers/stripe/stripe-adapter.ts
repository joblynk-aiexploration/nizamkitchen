import { PaymentOrderStatus, Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createPaymentOrderForModule } from "@/server/payments/payment-service";
import { syncModulePaymentStatus, validateRefundAmount } from "@/server/payments/operations";
import type { PaymentGatewayAdapter } from "@/server/payments/payment-gateway";
import type { CreateCheckoutSessionInput, CreatePaymentIntentInput, RefundPaymentInput, WebhookHandleInput, WebhookValidationInput } from "@/server/payments/types";
import { createStripeClient, getStripeGateway, getStripeSecrets } from "@/server/payments/providers/stripe/stripe-client";
import { constructStripeWebhookEvent, handleStripeWebhook } from "@/server/payments/providers/stripe/stripe-webhooks";

export class StripePaymentGatewayAdapter implements PaymentGatewayAdapter {
  provider = "stripe" as const;

  async createCheckoutSession(input: CreateCheckoutSessionInput) {
    const gateway = await getStripeGateway(undefined, input.metadata?.countryCode as string | undefined, input.currencyCode);
    const secrets = getStripeSecrets(gateway);
    const stripe = createStripeClient(secrets.secretKey);
    const sellerAccountId = input.sellerOrganizationId ? await getSellerStripeAccountId(input.sellerOrganizationId) : null;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currencyCode.toLowerCase(),
            unit_amount: Math.round(input.amount * 100),
            product_data: { name: `${input.module.replace(/_/g, " ")} payment` },
          },
        },
      ],
      success_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        paymentOrderId: input.paymentOrderId,
        module: input.module,
        moduleEntityId: input.moduleEntityId,
      },
      payment_intent_data: {
        metadata: { paymentOrderId: input.paymentOrderId },
        ...(sellerAccountId && input.metadata?.platformFeeAmount
          ? {
              application_fee_amount: Math.round(Number(input.metadata.platformFeeAmount) * 100),
              transfer_data: { destination: sellerAccountId },
            }
          : {}),
      },
    });
    return {
      provider: "stripe" as const,
      status: PaymentOrderStatus.checkout_created,
      checkoutUrl: session.url ?? undefined,
      providerCheckoutSessionId: session.id,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  async createPaymentIntent(input: CreatePaymentIntentInput) {
    const gateway = await getStripeGateway(undefined, undefined, input.currencyCode);
    const secrets = getStripeSecrets(gateway);
    const stripe = createStripeClient(secrets.secretKey);
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(input.amount * 100),
      currency: input.currencyCode.toLowerCase(),
      metadata: { paymentOrderId: input.paymentOrderId, module: input.module, moduleEntityId: input.moduleEntityId },
      automatic_payment_methods: { enabled: true },
    });
    return { provider: "stripe" as const, status: PaymentOrderStatus.requires_action, providerPaymentIntentId: intent.id };
  }

  async capturePayment() {
    return { provider: "stripe" as const, status: PaymentOrderStatus.paid };
  }

  async cancelPayment() {
    return { provider: "stripe" as const, status: PaymentOrderStatus.cancelled };
  }

  async refundPayment(input: RefundPaymentInput) {
    const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: input.paymentOrderId } });
    const gateway = await getStripeGateway(order.gatewayId, order.countryCode, order.currencyCode);
    const secrets = getStripeSecrets(gateway);
    const stripe = createStripeClient(secrets.secretKey);
    const refund = await stripe.refunds.create({
      payment_intent: order.providerPaymentIntentId ?? undefined,
      amount: Math.round(input.amount * 100),
      reason: stripeRefundReason(input.reason),
      metadata: { paymentOrderId: order.id },
    });
    return { provider: "stripe" as const, status: PaymentOrderStatus.partially_refunded, providerTransactionId: refund.id };
  }

  async getPaymentStatus() {
    return { provider: "stripe" as const, status: PaymentOrderStatus.pending };
  }

  async validateWebhook(input: WebhookValidationInput) {
    const { event } = await constructStripeWebhookEvent({ rawBody: input.rawBody, signature: headerValue(input.headers["stripe-signature"]) });
    return { signatureValid: true, eventId: event.id, eventType: event.type };
  }

  async handleWebhookEvent(input: WebhookHandleInput) {
    const result = await handleStripeWebhook({ rawBody: input.rawBody, signature: headerValue(input.headers["stripe-signature"]), gatewayId: input.gatewayId });
    return { eventId: result.eventId, eventType: "stripe", signatureValid: true, handled: result.status === "processed", status: result.status };
  }

  supportsCountry() {
    return true;
  }

  supportsCurrency() {
    return true;
  }

  async getPublicClientConfig(input: { countryCode?: string; currencyCode?: string }) {
    const gateway = await getStripeGateway(undefined, input.countryCode, input.currencyCode);
    const secrets = getStripeSecrets(gateway);
    return { provider: "stripe", publishableKey: secrets.publishableKey ?? "", hostedCheckoutOnly: true };
  }
}

export const stripeAdapter = new StripePaymentGatewayAdapter();

export async function createStripeCheckoutForPaymentOrder(paymentOrderId: string, returnUrl: string, cancelUrl: string) {
  const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: paymentOrderId } });
  const result = await stripeAdapter.createCheckoutSession({
    paymentOrderId: order.id,
    amount: Number(order.amount),
    currencyCode: order.currencyCode,
    module: order.module,
    moduleEntityId: order.moduleEntityId,
    customerOrganizationId: order.customerOrganizationId ?? undefined,
    customerUserId: order.customerUserId ?? undefined,
    sellerOrganizationId: order.sellerOrganizationId ?? undefined,
    returnUrl,
    cancelUrl,
    metadata: { countryCode: order.countryCode, platformFeeAmount: order.platformFeeAmount ? Number(order.platformFeeAmount) : 0 },
  });
  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: {
      status: "checkout_created",
      checkoutUrl: result.checkoutUrl ?? null,
      providerCheckoutSessionId: result.providerCheckoutSessionId ?? null,
      expiresAt: result.expiresAt ?? null,
    },
  });
  return result;
}

export async function createStripeFoodOrderCheckout(params: { foodOrderId: string; userId: string; appUrl: string }) {
  const order = await prisma.foodOrder.findUniqueOrThrow({ where: { id: params.foodOrderId } });
  if (!order.subtotalAmount || order.subtotalAmount <= 0) throw new Error("This order does not have a payable amount.");
  const paymentOrder = await createPaymentOrderForModule({
    organizationId: order.organizationId,
    countryCode: order.countryCode,
    customerOrganizationId: order.customerOrganizationId,
    customerUserId: params.userId,
    sellerOrganizationId: order.sellerOrganizationId,
    module: "food_order",
    moduleEntityId: order.id,
    provider: "stripe",
    amount: order.subtotalAmount,
    currencyCode: order.currencyCode,
    idempotencyKey: `food-order:${order.id}`,
  });
  await prisma.foodOrder.update({ where: { id: order.id }, data: { paymentRequired: true, paymentStatus: "pending", paymentOrderId: paymentOrder.id } });
  return createStripeCheckoutForPaymentOrder(paymentOrder.id, `${params.appUrl}/orders/${order.id}?payment=success`, `${params.appUrl}/orders/${order.id}?payment=cancelled`);
}

export async function createStripeHomeChefCheckout(params: { requestId: string; userId: string; appUrl: string; paymentType: "deposit" | "full" }) {
  const request = await prisma.homeChefRequest.findUniqueOrThrow({ where: { id: params.requestId } });
  const amount = params.paymentType === "deposit" ? request.depositAmount : request.quotedAmount;
  if (!amount || amount <= 0) throw new Error("This home chef request does not have a payable quote yet.");
  const paymentOrder = await createPaymentOrderForModule({
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    customerOrganizationId: request.organizationId,
    customerUserId: params.userId,
    sellerOrganizationId: request.assignedChefOrganizationId ?? undefined,
    module: "home_chef_request",
    moduleEntityId: request.id,
    provider: "stripe",
    amount,
    currencyCode: request.currencyCode,
    idempotencyKey: `home-chef:${request.id}:${params.paymentType}`,
    metadataJson: { paymentType: params.paymentType },
  });
  await prisma.homeChefRequest.update({
    where: { id: request.id },
    data: { paymentRequired: true, paymentStatus: "pending", paymentOrderId: paymentOrder.id },
  });
  return createStripeCheckoutForPaymentOrder(paymentOrder.id, `${params.appUrl}/home-chef/requests/${request.id}?payment=success`, `${params.appUrl}/home-chef/requests/${request.id}?payment=cancelled`);
}

export async function createStripeSubscriptionCheckout(params: { organizationId: string; userId: string; planId: string; appUrl: string }) {
  const plan = await prisma.billingPlan.findUniqueOrThrow({ where: { id: params.planId } });
  if (!plan.stripePriceId) throw new Error("This billing plan does not have a Stripe Price ID configured.");
  const gateway = await getStripeGateway(undefined, undefined, plan.currencyCode);
  const secrets = getStripeSecrets(gateway);
  const stripe = createStripeClient(secrets.secretKey);
  const subscription = await prisma.billingSubscription.create({
    data: { organizationId: params.organizationId, planId: plan.id, status: "trialing", provider: "stripe" },
  });
  const paymentOrder = await createPaymentOrderForModule({
    organizationId: params.organizationId,
    countryCode: gateway.countryCode ?? "US",
    customerOrganizationId: params.organizationId,
    customerUserId: params.userId,
    module: "subscription",
    moduleEntityId: subscription.id,
    provider: "stripe",
    amount: Number(plan.priceAmount),
    currencyCode: plan.currencyCode,
    idempotencyKey: `subscription:${subscription.id}`,
    metadataJson: { billingSubscriptionId: subscription.id, planId: plan.id },
  });
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${params.appUrl}/billing?payment=success`,
    cancel_url: `${params.appUrl}/billing/plans?payment=cancelled`,
    metadata: { paymentOrderId: paymentOrder.id, billingSubscriptionId: subscription.id },
  });
  await prisma.billingSubscription.update({ where: { id: subscription.id }, data: { paymentOrderId: paymentOrder.id } });
  await prisma.paymentOrder.update({ where: { id: paymentOrder.id }, data: { status: "checkout_created", checkoutUrl: session.url, providerCheckoutSessionId: session.id } });
  return { checkoutUrl: session.url };
}

export async function createStripeConnectOnboarding(params: { organizationId: string; countryCode: string; currencyCode?: string; appUrl: string }) {
  const gateway = await getStripeGateway(undefined, params.countryCode, params.currencyCode);
  const secrets = getStripeSecrets(gateway);
  const stripe = createStripeClient(secrets.secretKey);
  const existing = await prisma.sellerPayoutAccount.findUnique({ where: { organizationId_provider: { organizationId: params.organizationId, provider: "stripe" } } });
  const accountId = existing?.providerAccountId ?? (await stripe.accounts.create({ type: "express", country: params.countryCode })).id;
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${params.appUrl}/settings/payments?refresh=1`,
    return_url: `${params.appUrl}/settings/payments?success=1`,
  });
  await prisma.sellerPayoutAccount.upsert({
    where: { organizationId_provider: { organizationId: params.organizationId, provider: "stripe" } },
    update: { gatewayId: gateway.id, providerAccountId: accountId, onboardingUrl: link.url, status: "pending" },
    create: { organizationId: params.organizationId, provider: "stripe", gatewayId: gateway.id, providerAccountId: accountId, onboardingUrl: link.url, countryCode: params.countryCode, currencyCode: params.currencyCode ?? null, status: "pending" },
  });
  return { onboardingUrl: link.url };
}

export async function createStripeRefundForPaymentOrder(params: { paymentOrderId: string; amount: number; reason?: string; requestedById: string }) {
  const { order, remaining } = await validateRefundAmount(params.paymentOrderId, params.amount);
  const result = await stripeAdapter.refundPayment({ paymentOrderId: order.id, amount: params.amount, currencyCode: order.currencyCode, reason: params.reason });
  const fullRefund = params.amount >= remaining;
  const refund = await prisma.paymentRefund.create({
    data: {
      paymentOrderId: order.id,
      organizationId: order.organizationId,
      provider: "stripe",
      gatewayId: order.gatewayId,
      status: "processing",
      amount: new Prisma.Decimal(params.amount),
      currencyCode: order.currencyCode,
      reason: params.reason ?? null,
      providerRefundId: result.providerTransactionId ?? null,
      requestedById: params.requestedById,
    },
  });
  await prisma.paymentOrder.update({ where: { id: order.id }, data: { status: fullRefund ? "refunded" : "partially_refunded" } });
  await syncModulePaymentStatus(order.id, fullRefund ? "refunded" : "partially_refunded");
  await prisma.paymentTransaction.create({
    data: {
      paymentOrderId: order.id,
      organizationId: order.organizationId,
      provider: "stripe",
      gatewayId: order.gatewayId,
      transactionType: "refund",
      status: "pending",
      amount: new Prisma.Decimal(params.amount),
      currencyCode: order.currencyCode,
      providerRefundId: result.providerTransactionId ?? null,
    },
  });
  return refund;
}

async function getSellerStripeAccountId(organizationId: string) {
  const account = await prisma.sellerPayoutAccount.findUnique({ where: { organizationId_provider: { organizationId, provider: "stripe" } } });
  return account?.status === "active" && account.chargesEnabled ? account.providerAccountId : null;
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function stripeRefundReason(reason?: string): Stripe.RefundCreateParams.Reason | undefined {
  if (reason === "fraudulent" || reason === "duplicate" || reason === "requested_by_customer") return reason;
  return undefined;
}
