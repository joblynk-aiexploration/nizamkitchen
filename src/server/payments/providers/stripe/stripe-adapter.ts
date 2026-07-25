import { PaymentOrderStatus, Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { generateAccountingForPaymentOrder } from "@/server/accounting/accounting-service";
import { assertPlanAudienceAllowed } from "@/server/billing/plan-audience";
import { lockPaidHomeChefRequestsForPaymentOrder } from "@/server/home-chef/home-chef-booking-lock-service";
import { createPaymentOrderForModule } from "@/server/payments/payment-service";
import { syncModulePaymentStatus, validateRefundAmount } from "@/server/payments/operations";
import { PaymentConfigurationError } from "@/server/payments/payment-errors";
import { createAuditEvent } from "@/server/audit";
import { notifyPaymentSucceeded } from "@/server/payments/payment-confirmation";
import {
  createAcceptedFoodOrderQuote,
  createAcceptedHomeChefQuote,
  createAcceptedSubscriptionQuote,
} from "@/server/pricing/checkout-quote-workflow";
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
    const refundTarget = await getStripeRefundTarget(stripe, order);
    const refund = await stripe.refunds.create({
      ...refundTarget,
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

type StripeRefundTargetOrder = {
  id: string;
  module?: string | null;
  moduleEntityId?: string | null;
  providerPaymentIntentId: string | null;
  providerCheckoutSessionId: string | null;
};

async function getStripeRefundTarget(stripe: Stripe, order: StripeRefundTargetOrder) {
  if (order.providerPaymentIntentId) return { payment_intent: order.providerPaymentIntentId };

  const chargeTransaction = await prisma.paymentTransaction.findFirst({
    where: {
      paymentOrderId: order.id,
      provider: "stripe",
      transactionType: "charge",
      status: "succeeded",
      OR: [
        { providerChargeId: { not: null } },
        { providerTransactionId: { startsWith: "ch_" } },
        { providerTransactionId: { startsWith: "pi_" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (chargeTransaction?.providerChargeId) return { charge: chargeTransaction.providerChargeId };
  if (chargeTransaction?.providerTransactionId?.startsWith("ch_")) return { charge: chargeTransaction.providerTransactionId };
  if (chargeTransaction?.providerTransactionId?.startsWith("pi_")) return { payment_intent: chargeTransaction.providerTransactionId };

  const checkoutSessionTarget = await getRefundTargetFromCheckoutSession(stripe, order);
  if (checkoutSessionTarget) return checkoutSessionTarget;

  const subscriptionTarget = await getRefundTargetFromSubscription(stripe, order);
  if (subscriptionTarget) return subscriptionTarget;

  const searchedTarget = await getRefundTargetFromStripeSearch(stripe, order.id);
  if (searchedTarget) {
    await persistRecoveredStripeRefundTarget(order.id, searchedTarget.paymentIntentId, searchedTarget.chargeId);
    return searchedTarget.paymentIntentId ? { payment_intent: searchedTarget.paymentIntentId } : { charge: searchedTarget.chargeId! };
  }

  throw new PaymentConfigurationError(
    "We could not find the Stripe payment reference needed to issue this refund. Please open the payment in Stripe, confirm the payment was completed, then reconcile the payment intent or charge on this payment record before refunding.",
  );
}

async function getRefundTargetFromCheckoutSession(stripe: Stripe, order: StripeRefundTargetOrder) {
  if (!order.providerCheckoutSessionId) return null;

  const session = await stripe.checkout.sessions.retrieve(order.providerCheckoutSessionId, {
    expand: [
      "payment_intent",
      "payment_intent.latest_charge",
      "invoice.payment_intent",
      "invoice.payment_intent.latest_charge",
      "subscription.latest_invoice.payment_intent",
      "subscription.latest_invoice.payment_intent.latest_charge",
    ],
  });

  const recovered = paymentIntentAndChargeFromCheckoutSession(session);
  if (!recovered.paymentIntentId && !recovered.chargeId) return null;

  await persistRecoveredStripeRefundTarget(order.id, recovered.paymentIntentId, recovered.chargeId);
  return recovered.paymentIntentId ? { payment_intent: recovered.paymentIntentId } : { charge: recovered.chargeId! };
}

async function getRefundTargetFromSubscription(stripe: Stripe, order: StripeRefundTargetOrder) {
  if (order.module !== "subscription") return null;

  const subscription = await prisma.billingSubscription.findFirst({
    where: {
      OR: [
        { paymentOrderId: order.id },
        ...(order.moduleEntityId ? [{ id: order.moduleEntityId }] : []),
      ],
    },
    select: { providerSubscriptionId: true },
  });
  if (!subscription?.providerSubscriptionId) return null;

  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.providerSubscriptionId, {
    expand: ["latest_invoice.payment_intent", "latest_invoice.payment_intent.latest_charge"],
  });
  const recovered = paymentIntentAndChargeFromSubscription(stripeSubscription);
  if (!recovered.paymentIntentId && !recovered.chargeId) return null;

  await persistRecoveredStripeRefundTarget(order.id, recovered.paymentIntentId, recovered.chargeId);
  return recovered.paymentIntentId ? { payment_intent: recovered.paymentIntentId } : { charge: recovered.chargeId! };
}

async function getRefundTargetFromStripeSearch(stripe: Stripe, paymentOrderId: string) {
  if (!stripe.paymentIntents || !("search" in stripe.paymentIntents)) return null;

  try {
    const results = await stripe.paymentIntents.search({
      query: `metadata['paymentOrderId']:'${paymentOrderId}'`,
      limit: 1,
      expand: ["data.latest_charge"],
    });
    const intent = results.data[0];
    if (!intent) return null;
    return paymentIntentAndChargeFromPaymentIntent(intent);
  } catch {
    return null;
  }
}

async function persistRecoveredStripeRefundTarget(paymentOrderId: string, paymentIntentId?: string | null, chargeId?: string | null) {
  if (paymentIntentId) {
    await prisma.paymentOrder.update({
      where: { id: paymentOrderId },
      data: { providerPaymentIntentId: paymentIntentId },
    });
  }
  if (chargeId) {
    await prisma.paymentTransaction.updateMany({
      where: { paymentOrderId, provider: "stripe", transactionType: "charge", status: "succeeded", providerChargeId: null },
      data: { providerChargeId: chargeId },
    });
  }
}

function paymentIntentAndChargeFromCheckoutSession(session: Stripe.Checkout.Session) {
  const extended = session as unknown as {
    invoice?: string | { payment_intent?: Stripe.PaymentIntent | string | null } | null;
    subscription?: string | { latest_invoice?: string | { payment_intent?: Stripe.PaymentIntent | string | null } | null } | null;
  };
  return firstPaymentIntentAndCharge([
    session.payment_intent,
    typeof extended.invoice === "object" ? extended.invoice?.payment_intent : null,
    typeof extended.subscription === "object" && typeof extended.subscription?.latest_invoice === "object"
      ? extended.subscription.latest_invoice?.payment_intent
      : null,
  ]);
}

function paymentIntentAndChargeFromSubscription(subscription: Stripe.Subscription) {
  const extended = subscription as unknown as {
    latest_invoice?: string | { payment_intent?: Stripe.PaymentIntent | string | null } | null;
  };
  return firstPaymentIntentAndCharge([
    typeof extended.latest_invoice === "object" ? extended.latest_invoice?.payment_intent : null,
  ]);
}

function paymentIntentAndChargeFromPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  return firstPaymentIntentAndCharge([paymentIntent]);
}

function firstPaymentIntentAndCharge(paymentIntents: Array<Stripe.PaymentIntent | string | null | undefined>) {
  for (const paymentIntent of paymentIntents) {
    const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id ?? null;
    const latestCharge = typeof paymentIntent === "object" && paymentIntent ? paymentIntent.latest_charge : null;
    const chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id ?? null;
    if (paymentIntentId || chargeId) return { paymentIntentId, chargeId };
  }
  return { paymentIntentId: null, chargeId: null };
}

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
  const order = await prisma.foodOrder.findUniqueOrThrow({
    where: { id: params.foodOrderId },
    include: { items: true },
  });
  if (!order.subtotalAmount || order.subtotalAmount <= 0) throw new Error("This order does not have a payable amount.");
  const idempotencyKey = `food-order:${order.id}`;
  const existingPaymentOrder = await prisma.paymentOrder.findUnique({ where: { idempotencyKey } });
  if (existingPaymentOrder) {
    await prisma.foodOrder.update({ where: { id: order.id }, data: { paymentRequired: true, paymentStatus: "pending", paymentOrderId: existingPaymentOrder.id } });
    return createStripeCheckoutForPaymentOrder(existingPaymentOrder.id, `${params.appUrl}/orders/${order.id}?payment=success`, `${params.appUrl}/orders/${order.id}?payment=cancelled`);
  }
  const quote = await createAcceptedFoodOrderQuote({ order, userId: params.userId });
  const payableAmount = Number(quote.totalAmount);
  if (payableAmount <= 0) throw new Error("This order total is zero after discounts. Hosted checkout is not required.");
  const paymentOrder = await createPaymentOrderForModule({
    organizationId: order.organizationId,
    countryCode: order.countryCode,
    customerOrganizationId: order.customerOrganizationId,
    customerUserId: params.userId,
    sellerOrganizationId: order.sellerOrganizationId,
    module: "food_order",
    moduleEntityId: order.id,
    provider: "stripe",
    amount: payableAmount,
    currencyCode: order.currencyCode,
    checkoutQuoteId: quote.id,
    idempotencyKey,
  });
  await prisma.paymentOrder.update({
    where: { id: paymentOrder.id },
    data: {
      promotionCode: order.promotionCode ?? paymentOrder.promotionCode,
      discountAmount: quote.discountAmount,
      platformCreditAmount: new Prisma.Decimal(order.platformCreditAppliedAmount ?? 0),
    },
  });
  await prisma.foodOrder.update({ where: { id: order.id }, data: { paymentRequired: true, paymentStatus: "pending", paymentOrderId: paymentOrder.id } });
  return createStripeCheckoutForPaymentOrder(paymentOrder.id, `${params.appUrl}/orders/${order.id}?payment=success`, `${params.appUrl}/orders/${order.id}?payment=cancelled`);
}

export async function createStripeHomeChefCheckout(params: { requestId: string; userId: string; appUrl: string; paymentType: "deposit" | "full"; promotionCode?: string | null }) {
  const request = await prisma.homeChefRequest.findUniqueOrThrow({ where: { id: params.requestId } });
  const amount = params.paymentType === "deposit" ? request.depositAmount : request.quotedAmount;
  if (!amount || amount <= 0) throw new Error("This home chef request does not have a payable quote yet.");
  const idempotencyKey = `home-chef:${request.id}:${params.paymentType}`;
  const existingPaymentOrder = await prisma.paymentOrder.findUnique({ where: { idempotencyKey } });
  if (existingPaymentOrder) {
    await prisma.homeChefRequest.update({
      where: { id: request.id },
      data: {
        paymentRequired: true,
        paymentStatus: "pending",
        paymentOrderId: existingPaymentOrder.id,
        promotionCode: existingPaymentOrder.promotionCode,
      },
    });
    return createStripeCheckoutForPaymentOrder(existingPaymentOrder.id, `${params.appUrl}/home-chef/requests/${request.id}?payment=success`, `${params.appUrl}/home-chef/requests/${request.id}?payment=cancelled`);
  }
  const quote = await createAcceptedHomeChefQuote({
    request,
    userId: params.userId,
    paymentType: params.paymentType,
    promotionCode: params.promotionCode,
  });
  const paymentOrder = await createPaymentOrderForModule({
    organizationId: request.organizationId,
    countryCode: request.countryCode,
    customerOrganizationId: request.organizationId,
    customerUserId: params.userId,
    sellerOrganizationId: request.assignedChefOrganizationId ?? undefined,
    module: "home_chef_request",
    moduleEntityId: request.id,
    provider: "stripe",
    amount: Number(quote.totalAmount),
    currencyCode: request.currencyCode,
    checkoutQuoteId: quote.id,
    idempotencyKey,
    promotionCode: params.promotionCode ?? undefined,
    metadataJson: { paymentType: params.paymentType },
  });
  await prisma.homeChefRequest.update({
    where: { id: request.id },
    data: {
      paymentRequired: true,
      paymentStatus: "pending",
      paymentOrderId: paymentOrder.id,
      promotionCode: paymentOrder.promotionCode,
      promotionDiscountAmount: Number(quote.discountAmount) || null,
    },
  });
  return createStripeCheckoutForPaymentOrder(paymentOrder.id, `${params.appUrl}/home-chef/requests/${request.id}?payment=success`, `${params.appUrl}/home-chef/requests/${request.id}?payment=cancelled`);
}

export async function createStripeSubscriptionCheckout(params: {
  organizationId: string;
  userId: string;
  planId: string;
  appUrl: string;
  promotionCode?: string | null;
}) {
  const plan = await prisma.billingPlan.findUniqueOrThrow({ where: { id: params.planId } });
  if (plan.status !== "active") {
    throw new Error("This billing plan is not available for purchase.");
  }
  const priceAmount = Number(plan.priceAmount);
  if (priceAmount <= 0) throw new Error("This billing plan does not require payment.");
  if (!plan.stripePriceId && plan.billingInterval === "custom") {
    throw new Error("Custom billing plans require manual setup.");
  }
  const [organization, user] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { countryCode: true, currencyCode: true, organizationType: true },
    }),
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { platformRole: true },
    }),
  ]);
  assertPlanAudienceAllowed({
    planAudience: plan.planAudience,
    organizationType: organization?.organizationType,
    platformRole: user?.platformRole,
  });
  if (organization?.currencyCode && organization.currencyCode !== plan.currencyCode) {
    throw new Error("This plan is not available for your account currency.");
  }
  const countryCode = organization?.countryCode ?? "US";
  const gateway = await getStripeGateway(undefined, countryCode, plan.currencyCode);
  const secrets = getStripeSecrets(gateway);
  const stripe = createStripeClient(secrets.secretKey);
  const subscription = await prisma.billingSubscription.create({
    data: { organizationId: params.organizationId, planId: plan.id, status: "unpaid", provider: "stripe" },
  });
  const quote = await createAcceptedSubscriptionQuote({
    plan,
    subscriptionId: subscription.id,
    organizationId: params.organizationId,
    userId: params.userId,
    countryCode,
    promotionCode: params.promotionCode,
  });
  const paymentOrder = await createPaymentOrderForModule({
    organizationId: params.organizationId,
    countryCode,
    customerOrganizationId: params.organizationId,
    customerUserId: params.userId,
    module: "subscription",
    moduleEntityId: subscription.id,
    provider: "stripe",
    amount: Number(quote.totalAmount),
    currencyCode: plan.currencyCode,
    checkoutQuoteId: quote.id,
    idempotencyKey: `subscription:${subscription.id}`,
    promotionCode: params.promotionCode ?? undefined,
    metadataJson: { billingSubscriptionId: subscription.id, planId: plan.id },
  });
  const discountAmount = Number(paymentOrder.discountAmount ?? 0);
  const checkoutDiscount = discountAmount > 0
    ? await createOneTimeStripeSubscriptionCoupon({
        stripe,
        amount: discountAmount,
        currencyCode: plan.currencyCode,
        name: `NizamKitchen ${paymentOrder.promotionCode ?? "promo"} subscription discount`,
      })
    : null;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: subscription.id,
    line_items: [
      plan.stripePriceId
        ? { price: plan.stripePriceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: plan.currencyCode.toLowerCase(),
              unit_amount: Math.round(priceAmount * 100),
              recurring: { interval: plan.billingInterval === "yearly" ? "year" : "month" },
              product_data: { name: plan.name, description: plan.description ?? undefined },
            },
          },
    ],
    ...(checkoutDiscount ? { discounts: [{ coupon: checkoutDiscount.id }] } : {}),
    success_url: `${params.appUrl}/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.appUrl}/billing/plans?payment=cancelled`,
    subscription_data: {
      metadata: {
        paymentOrderId: paymentOrder.id,
        billingSubscriptionId: subscription.id,
        organizationId: params.organizationId,
        planId: plan.id,
      },
    },
    metadata: {
      paymentOrderId: paymentOrder.id,
      billingSubscriptionId: subscription.id,
      promotionCode: paymentOrder.promotionCode ?? "",
      discountAmount: discountAmount ? discountAmount.toFixed(2) : "",
    },
  });
  await prisma.billingSubscription.update({ where: { id: subscription.id }, data: { paymentOrderId: paymentOrder.id } });
  await prisma.paymentOrder.update({ where: { id: paymentOrder.id }, data: { status: "checkout_created", checkoutUrl: session.url, providerCheckoutSessionId: session.id } });
  return { checkoutUrl: session.url };
}

async function createOneTimeStripeSubscriptionCoupon({
  stripe,
  amount,
  currencyCode,
  name,
}: {
  stripe: Stripe;
  amount: number;
  currencyCode: string;
  name: string;
}) {
  return stripe.coupons.create({
    amount_off: Math.round(amount * 100),
    currency: currencyCode.toLowerCase(),
    duration: "once",
    name,
  });
}

export async function finalizeStripeSubscriptionCheckout(params: { sessionId: string; userId: string; organizationId: string }) {
  const paymentOrder = await prisma.paymentOrder.findFirst({
    where: {
      provider: "stripe",
      providerCheckoutSessionId: params.sessionId,
      customerUserId: params.userId,
      customerOrganizationId: params.organizationId,
      module: "subscription",
    },
  });
  if (!paymentOrder) throw new Error("Checkout session was not found for this account.");

  const gateway = await getStripeGateway(paymentOrder.gatewayId, paymentOrder.countryCode, paymentOrder.currencyCode);
  const secrets = getStripeSecrets(gateway);
  const stripe = createStripeClient(secrets.secretKey);
  const session = await stripe.checkout.sessions.retrieve(params.sessionId);
  if (session.payment_status !== "paid" && session.status !== "complete") {
    throw new Error("Stripe checkout is not paid yet.");
  }

  const paidOrder = await markStripePaymentOrderPaid(paymentOrder.id, {
    providerCheckoutSessionId: session.id,
    providerPaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    providerCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
  });

  const billingSubscriptionId = session.metadata?.billingSubscriptionId ?? paymentOrder.moduleEntityId;
  await prisma.billingSubscription.update({
    where: { id: billingSubscriptionId },
    data: {
      provider: "stripe",
      providerCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      providerSubscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
      status: "active",
      currentPeriodStart: paidOrder.paidAt ?? new Date(),
    },
  });

  await generateAccountingForPaymentOrder(paidOrder.id, params.userId);
  await notifyPaymentSucceeded(paidOrder).catch((error) => {
    console.error("Unable to send payment success notifications", error);
  });
  return { paymentOrderId: paidOrder.id, billingSubscriptionId };
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
  await createAuditEvent({
    actorUserId: params.requestedById,
    organizationId: order.organizationId,
    countryCode: order.countryCode,
    action: "payment_refund.requested",
    targetType: "payment_refund",
    targetId: refund.id,
    details: { provider: "stripe", amount: params.amount, fullRefund },
  });
  return refund;
}

export async function markStripePaymentOrderPaid(paymentOrderId: string, providerIds: { providerCheckoutSessionId?: string; providerPaymentIntentId?: string; providerCustomerId?: string }) {
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
  await lockPaidHomeChefRequestsForPaymentOrder(paymentOrderId);
  await createAuditEvent({ action: "payment_order.paid", targetType: "payment_order", targetId: order.id, organizationId: order.organizationId, countryCode: order.countryCode });
  return order;
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
