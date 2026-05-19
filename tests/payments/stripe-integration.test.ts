import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, stripeClient } = vi.hoisted(() => ({
  stripeClient: {
    checkout: { sessions: { create: vi.fn() } },
    refunds: { create: vi.fn() },
    accounts: { create: vi.fn() },
    accountLinks: { create: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  },
  mockPrisma: {
    paymentGateway: { findFirst: vi.fn(), findUnique: vi.fn() },
    paymentConfiguration: { findUnique: vi.fn() },
    paymentOrder: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    paymentTransaction: { create: vi.fn() },
    paymentRefund: { create: vi.fn() },
    paymentWebhookEvent: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    foodOrder: { findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    homeChefRequest: { updateMany: vi.fn() },
    billingPlan: { findUniqueOrThrow: vi.fn() },
    billingSubscription: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    sellerPayoutAccount: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("stripe", () => ({ default: vi.fn(() => stripeClient) }));
vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: "stripe-test-encryption-key-that-is-long-enough", APP_URL: "http://localhost:3000" } }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { createAuditEvent } from "@/server/audit";
import { encryptGatewayCredential } from "@/server/payments/credentials";
import {
  createStripeConnectOnboarding,
  createStripeFoodOrderCheckout,
  createStripeRefundForPaymentOrder,
  createStripeSubscriptionCheckout,
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
    mockPrisma.paymentConfiguration.findUnique.mockResolvedValue({ platformCommissionPercent: "10", fixedCommissionAmount: "1.00", taxPercent: "0" });
    mockPrisma.paymentOrder.findUnique.mockResolvedValue(null);
    mockPrisma.paymentOrder.create.mockImplementation(async ({ data }) => ({ id: "payment-order-1", status: "pending", ...data }));
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
    stripeClient.checkout.sessions.create.mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.test/session", expires_at: 123 });
  });

  it("creates food order checkout with server-calculated amount and application fee", async () => {
    const checkout = await createStripeFoodOrderCheckout({ foodOrderId: "food-order-1", userId: "user-1", appUrl: "http://localhost:3000" });
    expect(checkout.checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(mockPrisma.paymentOrder.create.mock.calls[0][0].data.amount.toString()).toBe("50");
    expect(stripeClient.checkout.sessions.create.mock.calls[0][0].payment_intent_data.application_fee_amount).toBe(600);
    expect(mockPrisma.foodOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentStatus: "pending" }) }));
  });

  it("creates subscription checkout from server plan Stripe Price ID", async () => {
    mockPrisma.billingPlan.findUniqueOrThrow.mockResolvedValue({ id: "plan-1", stripePriceId: "price_123", currencyCode: "USD", priceAmount: new Prisma.Decimal(19) });
    mockPrisma.billingSubscription.create.mockResolvedValue({ id: "subscription-1" });
    const checkout = await createStripeSubscriptionCheckout({ organizationId: "org-household", userId: "user-1", planId: "plan-1", appUrl: "http://localhost:3000" });
    expect(checkout.checkoutUrl).toBe("https://checkout.stripe.test/session");
    expect(stripeClient.checkout.sessions.create.mock.calls[0][0].mode).toBe("subscription");
    expect(stripeClient.checkout.sessions.create.mock.calls[0][0].line_items[0].price).toBe("price_123");
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
    mockPrisma.paymentOrder.update.mockResolvedValue({ id: "payment-order-1", organizationId: "org-household", countryCode: "US", currencyCode: "USD", gatewayId: "gateway-stripe", amount: new Prisma.Decimal(50) });
    const result = await handleStripeWebhook({ rawBody: "{}", signature: "sig" });
    expect(result.status).toBe("processed");
    expect(mockPrisma.foodOrder.updateMany).toHaveBeenCalledWith({ where: { paymentOrderId: "payment-order-1" }, data: { paymentStatus: "paid", paidAt: expect.any(Date) } });
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "payment_order.paid" }));
  });

  it("creates refund records without letting sellers process refunds", async () => {
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({ id: "payment-order-1", organizationId: "org-household", countryCode: "US", currencyCode: "USD", gatewayId: "gateway-stripe", providerPaymentIntentId: "pi_1" });
    stripeClient.refunds.create.mockResolvedValue({ id: "re_1" });
    mockPrisma.paymentRefund.create.mockResolvedValue({ id: "refund-1" });
    await createStripeRefundForPaymentOrder({ paymentOrderId: "payment-order-1", amount: 10, requestedById: "admin-1" });
    expect(stripeClient.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, payment_intent: "pi_1" }));
    expect(mockPrisma.paymentRefund.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ requestedById: "admin-1" }) }));
  });
});
