import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, stripeClient } = vi.hoisted(() => ({
  stripeClient: {
    checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
    paymentIntents: { search: vi.fn() },
    subscriptions: { retrieve: vi.fn() },
    coupons: { create: vi.fn() },
    refunds: { create: vi.fn() },
    accounts: { create: vi.fn() },
    accountLinks: { create: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  },
  mockPrisma: {
    paymentGateway: { findFirst: vi.fn(), findUnique: vi.fn() },
    platformIntegration: { findFirst: vi.fn() },
    paymentConfiguration: { findUnique: vi.fn() },
    paymentOrder: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    promotion: { findUnique: vi.fn() },
    promotionRedemption: { count: vi.fn(), upsert: vi.fn() },
    paymentTransaction: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    paymentRefund: { create: vi.fn() },
    paymentDispute: { upsert: vi.fn() },
    paymentWebhookEvent: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    foodOrder: { findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    homeChefRequest: { updateMany: vi.fn() },
    billingPlan: { findUniqueOrThrow: vi.fn() },
    billingSubscription: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn() },
    notification: { findFirst: vi.fn() },
    accountingDocument: { findUnique: vi.fn(), create: vi.fn() },
    commissionRecord: { findUnique: vi.fn(), create: vi.fn() },
    sellerPayoutAccount: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    sellerVerificationPolicy: { findMany: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn() },
    sellerVerificationOverride: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("stripe", () => ({ default: vi.fn(() => stripeClient) }));
vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: "stripe-test-encryption-key-that-is-long-enough", APP_URL: "http://localhost:3000" } }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));
vi.mock("@/server/email/email-service", () => ({ sendTemplateEmail: vi.fn() }));
vi.mock("@/server/notifications/notification-service", () => ({ createAdminNotification: vi.fn(), createNotification: vi.fn() }));

import { createAuditEvent } from "@/server/audit";
import { sendTemplateEmail } from "@/server/email/email-service";
import { createNotification } from "@/server/notifications/notification-service";
import { encryptGatewayCredential } from "@/server/payments/credentials";
import {
  createStripeConnectOnboarding,
  createStripeFoodOrderCheckout,
  createStripeRefundForPaymentOrder,
  createStripeSubscriptionCheckout,
  finalizeStripeSubscriptionCheckout,
} from "@/server/payments/providers/stripe/stripe-adapter";
import { handleStripeWebhook } from "@/server/payments/providers/stripe/stripe-webhooks";

function gateway() {
  return {
    id: "gateway-stripe",
    provider: "stripe",
    status: "active",
    countryCode: "US",
    supportedCountriesJson: ["US"],
    supportedCurrenciesJson: ["USD"],
    credentials: [
      { keyName: "secret_key", encryptedValue: encryptGatewayCredential("stripe-secret-key") },
      { keyName: "publishable_key", encryptedValue: encryptGatewayCredential("stripe-publishable-key") },
      { keyName: "webhook_secret", encryptedValue: encryptGatewayCredential("stripe-webhook-secret") },
    ],
    settings: [],
  };
}

describe("Stripe payment gateway integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.paymentGateway.findFirst.mockResolvedValue(gateway());
    mockPrisma.paymentGateway.findUnique.mockResolvedValue(gateway());
    mockPrisma.platformIntegration.findFirst.mockResolvedValue(null);
    mockPrisma.paymentConfiguration.findUnique.mockResolvedValue({ platformCommissionPercent: "10", fixedCommissionAmount: "1.00", taxPercent: "0" });
    mockPrisma.paymentOrder.findUnique.mockResolvedValue(null);
    mockPrisma.promotion.findUnique.mockResolvedValue(null);
    mockPrisma.promotionRedemption.count.mockResolvedValue(0);
    mockPrisma.promotionRedemption.upsert.mockResolvedValue({ id: "redemption-1" });
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "seller-1", organizationType: "home_catering", countryCode: "US" });
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.sellerVerificationOverride.findFirst.mockResolvedValue(null);
    mockPrisma.paymentOrder.findFirst.mockResolvedValue({ id: "payment-order-1", organizationId: "org-household", countryCode: "US" });
    mockPrisma.paymentOrder.create.mockImplementation(async ({ data }) => ({ id: "payment-order-1", status: "pending", ...data }));
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue(null);
    mockPrisma.paymentTransaction.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      organizationId: "org-household",
      countryCode: "US",
      currencyCode: "USD",
      amount: new Prisma.Decimal(50),
      platformFeeAmount: new Prisma.Decimal(6),
      module: "food_order",
      moduleEntityId: "food-order-1",
      customerOrganizationId: "org-household",
      customerUserId: "user-1",
      sellerOrganizationId: "seller-1",
    });
    mockPrisma.paymentOrder.update.mockImplementation(async ({ data }) => ({ id: "payment-order-1", organizationId: "org-household", countryCode: "US", currencyCode: "USD", amount: new Prisma.Decimal(50), ...data }));
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "household@nizamkitchen.dev", fullName: "Household User" });
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockPrisma.accountingDocument.findUnique.mockResolvedValue(null);
    mockPrisma.accountingDocument.create.mockResolvedValue({ id: "doc-1" });
    mockPrisma.commissionRecord.findUnique.mockResolvedValue(null);
    mockPrisma.commissionRecord.create.mockResolvedValue({ id: "commission-1" });
    mockPrisma.foodOrder.findUniqueOrThrow.mockResolvedValue({
      id: "food-order-1",
      organizationId: "org-household",
      countryCode: "US",
      customerOrganizationId: "org-household",
      sellerOrganizationId: "seller-1",
      subtotalAmount: 50,
      currencyCode: "USD",
    });
    mockPrisma.sellerPayoutAccount.findUnique.mockResolvedValue({ status: "active", chargesEnabled: true, providerAccountId: "acct_seller" });
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue({ status: "active", chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, providerAccountId: "acct_seller" });
    stripeClient.checkout.sessions.create.mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.test/session", expires_at: 123 });
    stripeClient.coupons.create.mockResolvedValue({ id: "coupon_subscription_discount" });
    stripeClient.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_test_1",
      status: "complete",
      payment_status: "paid",
      customer: "cus_1",
      subscription: "sub_1",
      payment_intent: null,
      metadata: { paymentOrderId: "payment-order-1", billingSubscriptionId: "subscription-1" },
    });
  });

  it("creates food order checkout with server-calculated amount and application fee", async () => {
    const checkout = await createStripeFoodOrderCheckout({ foodOrderId: "food-order-1", userId: "user-1", appUrl: "http://localhost:3000" });
    expect(checkout.checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(mockPrisma.paymentOrder.create.mock.calls[0][0].data.amount.toString()).toBe("50");
    expect(stripeClient.checkout.sessions.create.mock.calls[0][0].payment_intent_data.application_fee_amount).toBe(600);
    expect(mockPrisma.foodOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentStatus: "pending" }) }));
  });

  it("creates subscription checkout from server plan Stripe Price ID", async () => {
    mockPrisma.billingPlan.findUniqueOrThrow.mockResolvedValue({ id: "plan-1", stripePriceId: "price_123", currencyCode: "USD", priceAmount: new Prisma.Decimal(19), billingInterval: "monthly", status: "active" });
    mockPrisma.billingSubscription.create.mockResolvedValue({ id: "subscription-1" });
    const checkout = await createStripeSubscriptionCheckout({ organizationId: "org-household", userId: "user-1", planId: "plan-1", appUrl: "http://localhost:3000" });
    expect(checkout.checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(mockPrisma.billingSubscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "unpaid", provider: "stripe" }),
    }));
    expect(stripeClient.checkout.sessions.create.mock.calls[0][0].mode).toBe("subscription");
    expect(stripeClient.checkout.sessions.create.mock.calls[0][0].line_items[0].price).toBe("price_123");
  });

  it("creates subscription checkout when Stripe is configured through API Management", async () => {
    mockPrisma.paymentGateway.findFirst.mockResolvedValue(null);
    mockPrisma.platformIntegration.findFirst.mockResolvedValue({
      id: "integration-stripe",
      provider: "stripe",
      status: "active",
      countryCode: null,
      credentials: [
        { keyName: "secret_key", encryptedValue: encryptGatewayCredential("stripe-secret-key") },
        { keyName: "publishable_key", encryptedValue: encryptGatewayCredential("stripe-publishable-key") },
      ],
      settings: [{ settingKey: "supportedCurrencies", settingValueJson: ["USD"] }],
    });
    mockPrisma.billingPlan.findUniqueOrThrow.mockResolvedValue({ id: "plan-1", stripePriceId: "price_123", currencyCode: "USD", priceAmount: new Prisma.Decimal(19), billingInterval: "monthly", status: "active" });
    mockPrisma.billingSubscription.create.mockResolvedValue({ id: "subscription-1" });

    const checkout = await createStripeSubscriptionCheckout({ organizationId: "org-household", userId: "user-1", planId: "plan-1", appUrl: "http://localhost:3000" });

    expect(checkout.checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(mockPrisma.platformIntegration.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ provider: "stripe", status: "active" }),
    }));
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "subscription" }));
  });

  it("creates subscription checkout from the local billing plan amount when no Stripe Price ID is saved", async () => {
    mockPrisma.billingPlan.findUniqueOrThrow.mockResolvedValue({
      id: "plan-1",
      name: "Family Plus",
      description: "More planning power",
      stripePriceId: null,
      currencyCode: "USD",
      priceAmount: new Prisma.Decimal(4.99),
      billingInterval: "monthly",
      status: "active",
    });
    mockPrisma.billingSubscription.create.mockResolvedValue({ id: "subscription-1" });

    await createStripeSubscriptionCheckout({ organizationId: "org-household", userId: "user-1", planId: "plan-1", appUrl: "http://localhost:3000" });

    expect(stripeClient.checkout.sessions.create.mock.calls[0][0].line_items[0]).toEqual(expect.objectContaining({
      price_data: expect.objectContaining({
        unit_amount: 499,
        recurring: { interval: "month" },
        product_data: expect.objectContaining({ name: "Family Plus" }),
      }),
    }));
  });

  it("applies server-validated subscription promo codes to Stripe checkout", async () => {
    mockPrisma.billingPlan.findUniqueOrThrow.mockResolvedValue({
      id: "plan-1",
      name: "Family Plus",
      description: "More planning power",
      stripePriceId: null,
      currencyCode: "USD",
      priceAmount: new Prisma.Decimal(20),
      billingInterval: "monthly",
      status: "active",
    });
    mockPrisma.billingSubscription.create.mockResolvedValue({ id: "subscription-1" });
    mockPrisma.promotion.findUnique.mockResolvedValue({
      id: "promo-subscription",
      code: "SAVE25",
      name: "Subscription discount",
      description: null,
      promotionType: "promo_code",
      discountType: "percent",
      status: "active",
      scope: "platform",
      sellerOrganizationId: null,
      countryCode: "US",
      region: null,
      city: null,
      currencyCode: "USD",
      percentOff: new Prisma.Decimal(25),
      amountOff: null,
      minOrderAmount: null,
      maxDiscountAmount: null,
      startsAt: null,
      endsAt: null,
      usageLimit: null,
      perUserLimit: null,
      appliesToFoodOrders: false,
      appliesToHomeChefRequests: false,
      appliesToSubscriptions: true,
      createdById: "admin-1",
      updatedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await createStripeSubscriptionCheckout({
      organizationId: "org-household",
      userId: "user-1",
      planId: "plan-1",
      appUrl: "http://localhost:3000",
      promotionCode: "save25",
    });

    expect(mockPrisma.paymentOrder.create.mock.calls[0][0].data.amount.toString()).toBe("15");
    expect(mockPrisma.paymentOrder.create.mock.calls[0][0].data.discountAmount.toString()).toBe("5");
    expect(mockPrisma.paymentOrder.create.mock.calls[0][0].data.promotionCode).toBe("SAVE25");
    expect(mockPrisma.promotionRedemption.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        module: "subscription",
        moduleEntityId: "subscription-1",
        discountAmount: new Prisma.Decimal(5),
      }),
    }));
    expect(stripeClient.coupons.create).toHaveBeenCalledWith(expect.objectContaining({
      amount_off: 500,
      currency: "usd",
      duration: "once",
    }));
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      subscription_data: {
        metadata: expect.objectContaining({
          paymentOrderId: "payment-order-1",
          billingSubscriptionId: "subscription-1",
        }),
      },
      discounts: [{ coupon: "coupon_subscription_discount" }],
      metadata: expect.objectContaining({
        promotionCode: "SAVE25",
        discountAmount: "5.00",
      }),
    }));
  });

  it("blocks subscription checkout for draft billing plans", async () => {
    mockPrisma.billingPlan.findUniqueOrThrow.mockResolvedValue({
      id: "plan-1",
      name: "Draft Family Plus",
      description: "Not ready for purchase",
      stripePriceId: "price_123",
      currencyCode: "USD",
      priceAmount: new Prisma.Decimal(19),
      billingInterval: "monthly",
      status: "draft",
    });

    await expect(
      createStripeSubscriptionCheckout({
        organizationId: "org-household",
        userId: "user-1",
        planId: "plan-1",
        appUrl: "http://localhost:3000",
      }),
    ).rejects.toThrow("This billing plan is not available for purchase.");
    expect(mockPrisma.billingSubscription.create).not.toHaveBeenCalled();
    expect(stripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("finalizes paid subscription checkout from the Stripe return URL", async () => {
    const paidAt = new Date("2026-05-25T12:00:00.000Z");
    mockPrisma.paymentOrder.findFirst.mockResolvedValue({
      id: "payment-order-1",
      organizationId: "org-household",
      countryCode: "US",
      currencyCode: "USD",
      gatewayId: "gateway-stripe",
      customerUserId: "user-1",
      customerOrganizationId: "org-household",
      module: "subscription",
      moduleEntityId: "subscription-1",
      provider: "stripe",
      providerCheckoutSessionId: "cs_test_1",
      amount: new Prisma.Decimal(19),
    });
    mockPrisma.paymentOrder.findUnique.mockResolvedValue({ id: "payment-order-1", status: "checkout_created" });
    mockPrisma.paymentOrder.update.mockResolvedValue({
      id: "payment-order-1",
      organizationId: "org-household",
      countryCode: "US",
      currencyCode: "USD",
      gatewayId: "gateway-stripe",
      customerUserId: "user-1",
      module: "subscription",
      moduleEntityId: "subscription-1",
      provider: "stripe",
      amount: new Prisma.Decimal(19),
      taxAmount: new Prisma.Decimal(0),
      platformFeeAmount: new Prisma.Decimal(0),
      sellerAmount: new Prisma.Decimal(19),
      paidAt,
      createdAt: paidAt,
    });
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      status: "paid",
      organizationId: "org-household",
      customerOrganizationId: "org-household",
      sellerOrganizationId: null,
      countryCode: "US",
      currencyCode: "USD",
      module: "subscription",
      moduleEntityId: "subscription-1",
      amount: new Prisma.Decimal(19),
      taxAmount: new Prisma.Decimal(0),
      platformFeeAmount: new Prisma.Decimal(0),
      sellerAmount: new Prisma.Decimal(19),
      paidAt,
      createdAt: paidAt,
    });

    const result = await finalizeStripeSubscriptionCheckout({
      sessionId: "cs_test_1",
      userId: "user-1",
      organizationId: "org-household",
    });

    expect(result.billingSubscriptionId).toBe("subscription-1");
    expect(stripeClient.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_test_1");
    expect(mockPrisma.billingSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "subscription-1" },
      data: expect.objectContaining({ status: "active", providerSubscriptionId: "sub_1" }),
    }));
    expect(mockPrisma.accountingDocument.create).toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "subscription_payment_success" }));
    expect(sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({
      templateKey: "payment.success",
      idempotencyKey: "payment.success:payment-order-1",
    }));
  });

  it("creates Stripe Connect onboarding for seller organizations", async () => {
    mockPrisma.sellerPayoutAccount.findUnique.mockResolvedValue(null);
    stripeClient.accounts.create.mockResolvedValue({ id: "acct_new" });
    stripeClient.accountLinks.create.mockResolvedValue({ url: "https://connect.stripe.test/onboard" });
    const result = await createStripeConnectOnboarding({ organizationId: "seller-1", countryCode: "US", currencyCode: "USD", appUrl: "http://localhost:3000" });
    expect(result.onboardingUrl).toBe("https://connect.stripe.test/onboard");
    expect(mockPrisma.sellerPayoutAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ providerAccountId: "acct_new" }) }));
  });

  it("requires webhook signatures and ignores duplicate processed events", async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({ id: "evt_1", type: "payment_intent.succeeded", data: { object: { id: "pi_1", metadata: { paymentOrderId: "payment-order-1" } } } });
    mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValueOnce({ status: "processed" });
    const duplicate = await handleStripeWebhook({ rawBody: "{}", signature: "sig" });
    expect(duplicate.status).toBe("ignored");

    stripeClient.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error("bad signature");
    });
    await expect(handleStripeWebhook({ rawBody: "{}", signature: "bad" })).rejects.toThrow("bad signature");
  });

  it("processes paid webhook and updates module payment state", async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({ id: "evt_paid", type: "payment_intent.succeeded", data: { object: { id: "pi_paid", metadata: { paymentOrderId: "payment-order-1" } } } });
    mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.paymentOrder.update.mockResolvedValue({
      id: "payment-order-1",
      organizationId: "org-household",
      countryCode: "US",
      currencyCode: "USD",
      gatewayId: "gateway-stripe",
      customerUserId: "user-1",
      module: "subscription",
      moduleEntityId: "subscription-1",
      amount: new Prisma.Decimal(50),
      status: "paid",
      paidAt: new Date("2026-05-25T12:00:00.000Z"),
    });
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      status: "paid",
      organizationId: "org-household",
      customerOrganizationId: "org-household",
      sellerOrganizationId: null,
      countryCode: "US",
      currencyCode: "USD",
      module: "subscription",
      moduleEntityId: "subscription-1",
      amount: new Prisma.Decimal(50),
      taxAmount: new Prisma.Decimal(0),
      platformFeeAmount: new Prisma.Decimal(0),
      sellerAmount: new Prisma.Decimal(50),
      paidAt: new Date("2026-05-25T12:00:00.000Z"),
      createdAt: new Date("2026-05-25T12:00:00.000Z"),
    });
    const result = await handleStripeWebhook({ rawBody: "{}", signature: "sig" });
    expect(result.status).toBe("processed");
    expect(mockPrisma.foodOrder.updateMany).toHaveBeenCalledWith({ where: { paymentOrderId: "payment-order-1" }, data: { paymentStatus: "paid", paidAt: expect.any(Date) } });
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      type: "subscription_payment_success",
      title: "Subscription payment successful",
    }));
    expect(sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "household@nizamkitchen.dev",
      templateKey: "payment.success",
      idempotencyKey: "payment.success:payment-order-1",
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "payment_order.paid" }));
  });

  it("activates subscription from Stripe checkout.session.completed webhook", async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      id: "evt_checkout_subscription",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_subscription",
          mode: "subscription",
          payment_status: "paid",
          customer: "cus_subscription",
          subscription: "sub_subscription",
          payment_intent: null,
          metadata: {
            paymentOrderId: "payment-order-1",
            billingSubscriptionId: "subscription-1",
          },
        },
      },
    });
    mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.paymentOrder.findUnique.mockResolvedValue({ id: "payment-order-1", status: "checkout_created" });
    mockPrisma.paymentOrder.update.mockResolvedValue({
      id: "payment-order-1",
      organizationId: "org-household",
      countryCode: "US",
      currencyCode: "USD",
      gatewayId: "gateway-stripe",
      customerUserId: "user-1",
      module: "subscription",
      moduleEntityId: "subscription-1",
      provider: "stripe",
      amount: new Prisma.Decimal(19),
      taxAmount: new Prisma.Decimal(0),
      platformFeeAmount: new Prisma.Decimal(0),
      sellerAmount: new Prisma.Decimal(19),
      paidAt: new Date("2026-05-25T12:00:00.000Z"),
      createdAt: new Date("2026-05-25T12:00:00.000Z"),
    });
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      status: "paid",
      organizationId: "org-household",
      customerOrganizationId: "org-household",
      sellerOrganizationId: null,
      countryCode: "US",
      currencyCode: "USD",
      module: "subscription",
      moduleEntityId: "subscription-1",
      amount: new Prisma.Decimal(19),
      taxAmount: new Prisma.Decimal(0),
      platformFeeAmount: new Prisma.Decimal(0),
      sellerAmount: new Prisma.Decimal(19),
      paidAt: new Date("2026-05-25T12:00:00.000Z"),
      createdAt: new Date("2026-05-25T12:00:00.000Z"),
    });

    const result = await handleStripeWebhook({ rawBody: "{}", signature: "sig" });

    expect(result.status).toBe("processed");
    expect(mockPrisma.paymentOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payment-order-1" },
      data: expect.objectContaining({ status: "paid", providerCheckoutSessionId: "cs_subscription", providerCustomerId: "cus_subscription" }),
    }));
    expect(mockPrisma.billingSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "subscription-1" },
      data: expect.objectContaining({
        status: "active",
        provider: "stripe",
        providerCustomerId: "cus_subscription",
        providerSubscriptionId: "sub_subscription",
      }),
    }));
    expect(mockPrisma.accountingDocument.create).toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "subscription_payment_success" }));
    expect(sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({ templateKey: "payment.success" }));
  });

  it("activates subscription from Stripe invoice.paid webhook metadata", async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      id: "evt_invoice_paid",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_subscription",
          customer: "cus_subscription",
          subscription: "sub_subscription",
          payment_intent: "pi_subscription",
          period_start: 1780000000,
          period_end: 1782678400,
          parent: {
            subscription_details: {
              subscription: "sub_subscription",
              metadata: {
                paymentOrderId: "payment-order-1",
                billingSubscriptionId: "subscription-1",
              },
            },
          },
          metadata: {},
        },
      },
    });
    mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.billingSubscription.findUnique.mockResolvedValue({ id: "subscription-1", paymentOrderId: "payment-order-1" });
    mockPrisma.paymentOrder.findUnique.mockResolvedValue({ id: "payment-order-1", status: "checkout_created" });
    mockPrisma.paymentOrder.update.mockResolvedValue({
      id: "payment-order-1",
      organizationId: "org-household",
      countryCode: "US",
      currencyCode: "USD",
      gatewayId: "gateway-stripe",
      customerUserId: "user-1",
      module: "subscription",
      moduleEntityId: "subscription-1",
      provider: "stripe",
      amount: new Prisma.Decimal(19),
      taxAmount: new Prisma.Decimal(0),
      platformFeeAmount: new Prisma.Decimal(0),
      sellerAmount: new Prisma.Decimal(19),
      paidAt: new Date("2026-05-25T12:00:00.000Z"),
      createdAt: new Date("2026-05-25T12:00:00.000Z"),
    });
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      status: "paid",
      organizationId: "org-household",
      customerOrganizationId: "org-household",
      sellerOrganizationId: null,
      countryCode: "US",
      currencyCode: "USD",
      module: "subscription",
      moduleEntityId: "subscription-1",
      amount: new Prisma.Decimal(19),
      taxAmount: new Prisma.Decimal(0),
      platformFeeAmount: new Prisma.Decimal(0),
      sellerAmount: new Prisma.Decimal(19),
      paidAt: new Date("2026-05-25T12:00:00.000Z"),
      createdAt: new Date("2026-05-25T12:00:00.000Z"),
    });

    const result = await handleStripeWebhook({ rawBody: "{}", signature: "sig" });

    expect(result.status).toBe("processed");
    expect(mockPrisma.paymentOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "paid", providerPaymentIntentId: "pi_subscription", providerCustomerId: "cus_subscription" }),
    }));
    expect(mockPrisma.billingSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "subscription-1" },
      data: expect.objectContaining({
        status: "active",
        providerSubscriptionId: "sub_subscription",
        currentPeriodStart: new Date(1780000000 * 1000),
        currentPeriodEnd: new Date(1782678400 * 1000),
      }),
    }));
  });

  it("creates disputes from Stripe dispute webhooks", async () => {
    stripeClient.webhooks.constructEvent.mockReturnValue({
      id: "evt_dispute",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          amount: 2500,
          currency: "usd",
          reason: "fraudulent",
          payment_intent: "pi_1",
          evidence_details: { due_by: 1780000000 },
        },
      },
    });
    mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    const result = await handleStripeWebhook({ rawBody: "{}", signature: "sig" });
    expect(result.status).toBe("processed");
    expect(mockPrisma.paymentDispute.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        providerDisputeId: "dp_1",
        status: "needs_response",
        amount: new Prisma.Decimal(25),
        currencyCode: "USD",
      }),
    }));
  });

  it("creates refund records without letting sellers process refunds", async () => {
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({ id: "payment-order-1", status: "paid", organizationId: "org-household", countryCode: "US", currencyCode: "USD", amount: new Prisma.Decimal(50), gatewayId: "gateway-stripe", providerPaymentIntentId: "pi_1", refunds: [] });
    stripeClient.refunds.create.mockResolvedValue({ id: "re_1" });
    mockPrisma.paymentRefund.create.mockResolvedValue({ id: "refund-1" });
    await createStripeRefundForPaymentOrder({ paymentOrderId: "payment-order-1", amount: 10, requestedById: "admin-1" });
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, payment_intent: "pi_1" }));
    expect(mockPrisma.paymentRefund.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ requestedById: "admin-1" }) }));
  });

  it("recovers Stripe payment intent from checkout session before refunding", async () => {
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      status: "paid",
      organizationId: "org-household",
      countryCode: "US",
      currencyCode: "USD",
      amount: new Prisma.Decimal(50),
      gatewayId: "gateway-stripe",
      providerPaymentIntentId: null,
      providerCheckoutSessionId: "cs_test_1",
      refunds: [],
    });
    stripeClient.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_test_1",
      payment_intent: { id: "pi_recovered", latest_charge: { id: "ch_recovered" } },
    });
    stripeClient.refunds.create.mockResolvedValue({ id: "re_1" });
    mockPrisma.paymentRefund.create.mockResolvedValue({ id: "refund-1" });

    await createStripeRefundForPaymentOrder({ paymentOrderId: "payment-order-1", amount: 10, requestedById: "admin-1" });

    expect(stripeClient.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_test_1", expect.objectContaining({ expand: expect.arrayContaining(["payment_intent"]) }));
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, payment_intent: "pi_recovered" }));
    expect(mockPrisma.paymentTransaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { providerChargeId: "ch_recovered" } }));
  });

  it("recovers subscription invoice payment intent before refunding", async () => {
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      status: "paid",
      organizationId: "org-household",
      countryCode: "US",
      currencyCode: "USD",
      amount: new Prisma.Decimal(50),
      gatewayId: "gateway-stripe",
      module: "subscription",
      moduleEntityId: "subscription-1",
      providerPaymentIntentId: null,
      providerCheckoutSessionId: "cs_subscription",
      refunds: [],
    });
    stripeClient.checkout.sessions.retrieve.mockResolvedValue({
      id: "cs_subscription",
      payment_intent: null,
      invoice: null,
      subscription: { latest_invoice: { payment_intent: { id: "pi_invoice", latest_charge: { id: "ch_invoice" } } } },
    });
    stripeClient.refunds.create.mockResolvedValue({ id: "re_1" });
    mockPrisma.paymentRefund.create.mockResolvedValue({ id: "refund-1" });

    await createStripeRefundForPaymentOrder({ paymentOrderId: "payment-order-1", amount: 10, requestedById: "admin-1" });

    expect(stripeClient.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_subscription", expect.objectContaining({
      expand: expect.arrayContaining(["subscription.latest_invoice.payment_intent"]),
    }));
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, payment_intent: "pi_invoice" }));
    expect(mockPrisma.paymentOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ providerPaymentIntentId: "pi_invoice" }) }));
    expect(mockPrisma.paymentTransaction.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { providerChargeId: "ch_invoice" } }));
  });

  it("recovers payment intent from saved Stripe subscription when checkout session lacks invoice details", async () => {
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      status: "paid",
      organizationId: "org-household",
      countryCode: "US",
      currencyCode: "USD",
      amount: new Prisma.Decimal(50),
      gatewayId: "gateway-stripe",
      module: "subscription",
      moduleEntityId: "subscription-1",
      providerPaymentIntentId: null,
      providerCheckoutSessionId: "cs_subscription",
      refunds: [],
    });
    stripeClient.checkout.sessions.retrieve.mockResolvedValue({ id: "cs_subscription", payment_intent: null, invoice: null, subscription: null });
    mockPrisma.billingSubscription.findFirst.mockResolvedValue({ providerSubscriptionId: "sub_1" });
    stripeClient.subscriptions.retrieve.mockResolvedValue({
      id: "sub_1",
      latest_invoice: { payment_intent: { id: "pi_from_subscription", latest_charge: "ch_from_subscription" } },
    });
    stripeClient.refunds.create.mockResolvedValue({ id: "re_1" });
    mockPrisma.paymentRefund.create.mockResolvedValue({ id: "refund-1" });

    await createStripeRefundForPaymentOrder({ paymentOrderId: "payment-order-1", amount: 10, requestedById: "admin-1" });

    expect(stripeClient.subscriptions.retrieve).toHaveBeenCalledWith("sub_1", expect.objectContaining({
      expand: expect.arrayContaining(["latest_invoice.payment_intent"]),
    }));
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, payment_intent: "pi_from_subscription" }));
  });
});
