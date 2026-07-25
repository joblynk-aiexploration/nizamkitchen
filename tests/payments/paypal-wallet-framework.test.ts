import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    paymentGateway: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    paymentConfiguration: { findUnique: vi.fn() },
    feePolicy: { findMany: vi.fn() },
    taxConfiguration: { findFirst: vi.fn() },
    checkoutQuote: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    paymentOrder: { findUnique: vi.fn(), findFirstOrThrow: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    paymentTransaction: { create: vi.fn(), findFirst: vi.fn() },
    paymentRefund: { create: vi.fn() },
    paymentWebhookEvent: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    foodOrder: { findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    homeChefRequest: { updateMany: vi.fn() },
    sellerPayoutAccount: { findUnique: vi.fn(), findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    sellerVerificationPolicy: { findMany: vi.fn() },
    sellerVerificationProfile: { findUnique: vi.fn() },
    sellerVerificationOverride: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: "paypal-test-encryption-key-that-is-long-enough" } }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { PaymentModule, PaymentProvider } from "@prisma/client";
import { encryptGatewayCredential } from "@/server/payments/credentials";
import { getPaymentGatewayAdapter } from "@/server/payments/gateway-registry";
import { listAvailablePaymentMethods } from "@/server/payments/payment-methods";
import { createPayPalFoodOrderCheckout, createPayPalRefundForPaymentOrder, paypalAdapter } from "@/server/payments/providers/paypal/paypal-adapter";
import { handlePayPalWebhook } from "@/server/payments/providers/paypal/paypal-webhooks";

function paypalGateway() {
  return {
    id: "gateway-paypal",
    provider: "paypal",
    status: "active",
    environment: "sandbox",
    countryCode: "US",
    supportedCountriesJson: ["US"],
    supportedCurrenciesJson: ["USD"],
    credentials: [
      { keyName: "client_id", encryptedValue: encryptGatewayCredential("paypal-client-id") },
      { keyName: "client_secret", encryptedValue: encryptGatewayCredential("paypal-client-secret") },
      { keyName: "webhook_id", encryptedValue: encryptGatewayCredential("paypal-webhook-id") },
    ],
    settings: [],
  };
}

describe("PayPal and wallet gateway framework", () => {
  let checkoutQuoteRecord: Record<string, unknown>;

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes("/oauth2/token")) return Response.json({ access_token: "paypal-access-token" });
      if (url.includes("/checkout/orders") && !url.includes("/capture")) {
        return Response.json({ id: "paypal-order-1", links: [{ rel: "approve", href: "https://paypal.test/approve" }] });
      }
      if (url.includes("/capture")) {
        return Response.json({ id: "paypal-order-1", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "capture-1", status: "COMPLETED" }] } }] });
      }
      if (url.includes("/refund")) return Response.json({ id: "paypal-refund-1" });
      if (url.includes("/verify-webhook-signature")) return Response.json({ verification_status: "SUCCESS" });
      return Response.json({});
    }) as never;
    mockPrisma.paymentGateway.findFirst.mockResolvedValue(paypalGateway());
    mockPrisma.paymentGateway.findUnique.mockResolvedValue(paypalGateway());
    mockPrisma.paymentConfiguration.findUnique.mockResolvedValue({ allowStripe: true, allowPayPal: true, allowGooglePay: true, allowManualPayment: true, platformCommissionPercent: "10", fixedCommissionAmount: "0", taxPercent: "0" });
    mockPrisma.feePolicy.findMany.mockResolvedValue([]);
    mockPrisma.taxConfiguration.findFirst.mockResolvedValue(null);
    mockPrisma.checkoutQuote.create.mockImplementation(async ({ data }) => {
      checkoutQuoteRecord = {
        id: "checkout-quote-1",
        ...data,
        status: data.status,
        lines: data.lines?.create ?? [],
      };
      return checkoutQuoteRecord;
    });
    mockPrisma.checkoutQuote.findUnique.mockImplementation(async () => checkoutQuoteRecord);
    mockPrisma.checkoutQuote.update.mockImplementation(async ({ data }) => {
      checkoutQuoteRecord = { ...checkoutQuoteRecord, ...data };
      return checkoutQuoteRecord;
    });
    mockPrisma.paymentOrder.findUnique.mockResolvedValue(null);
    mockPrisma.organization.findUnique.mockResolvedValue({ id: "seller-1", organizationType: "home_catering", countryCode: "US" });
    mockPrisma.sellerVerificationPolicy.findMany.mockResolvedValue([]);
    mockPrisma.sellerVerificationProfile.findUnique.mockResolvedValue(null);
    mockPrisma.sellerVerificationOverride.findFirst.mockResolvedValue(null);
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue({ status: "active", chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true });
    mockPrisma.paymentOrder.create.mockImplementation(async ({ data }) => ({ id: "payment-order-1", status: "pending", ...data }));
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({ id: "payment-order-1", status: "paid", provider: "paypal", providerOrderId: "paypal-order-1", organizationId: "org-1", countryCode: "US", currencyCode: "USD", amount: new Prisma.Decimal(25), gatewayId: "gateway-paypal", refunds: [] });
    mockPrisma.paymentOrder.findFirstOrThrow.mockResolvedValue({ id: "payment-order-1", provider: "paypal", providerOrderId: "paypal-order-1", organizationId: "org-1", countryCode: "US", currencyCode: "USD", amount: new Prisma.Decimal(25), gatewayId: "gateway-paypal" });
    mockPrisma.paymentOrder.update.mockResolvedValue({ id: "payment-order-1", provider: "paypal", providerOrderId: "paypal-order-1", organizationId: "org-1", countryCode: "US", currencyCode: "USD", amount: new Prisma.Decimal(25), gatewayId: "gateway-paypal" });
    mockPrisma.foodOrder.findUniqueOrThrow.mockResolvedValue({ id: "food-1", organizationId: "org-1", countryCode: "US", customerOrganizationId: "org-1", sellerOrganizationId: "seller-1", subtotalAmount: 25, currencyCode: "USD" });
  });

  it("creates PayPal checkout from encrypted gateway credentials", async () => {
    const result = await createPayPalFoodOrderCheckout({ foodOrderId: "food-1", userId: "user-1", appUrl: "http://localhost:3000" });
    expect(result.checkoutUrl).toBe("https://paypal.test/approve");
    expect(mockPrisma.paymentOrder.create.mock.calls[0][0].data.provider).toBe("paypal");
    expect(mockPrisma.paymentOrder.create.mock.calls[0][0].data.checkoutQuoteId).toBe("checkout-quote-1");
    expect(String(global.fetch)).not.toContain("paypal-client-secret");
  });

  it("captures PayPal orders server-side before marking paid", async () => {
    await paypalAdapter.capturePayment({ providerOrderId: "paypal-order-1" });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/v2/checkout/orders/paypal-order-1/capture"), expect.objectContaining({ method: "POST" }));
    expect(mockPrisma.foodOrder.updateMany).toHaveBeenCalledWith({ where: { paymentOrderId: "payment-order-1" }, data: { paymentStatus: "paid", paidAt: expect.any(Date) } });
  });

  it("handles PayPal webhooks idempotently after signature verification", async () => {
    mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValueOnce({ status: "processed" });
    const ignored = await handlePayPalWebhook({ rawBody: JSON.stringify({ id: "evt-1", event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { supplementary_data: { related_ids: { order_id: "paypal-order-1" } } } }), headers: new Headers() });
    expect(ignored.status).toBe("ignored");
  });

  it("does not mark PayPal approved-only webhooks as paid before server capture", async () => {
    mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValue(null);
    await handlePayPalWebhook({ rawBody: JSON.stringify({ id: "evt-approved", event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "paypal-order-1" } }), headers: new Headers() });
    expect(mockPrisma.paymentOrder.updateMany).toHaveBeenCalledWith({
      where: { provider: "paypal", providerOrderId: "paypal-order-1", status: { not: "paid" } },
      data: { status: "requires_action" },
    });
    expect(mockPrisma.foodOrder.updateMany).not.toHaveBeenCalled();
  });

  it("creates PayPal refunds from successful captures", async () => {
    mockPrisma.paymentTransaction.findFirst.mockResolvedValue({ providerTransactionId: "capture-1" });
    mockPrisma.paymentRefund.create.mockResolvedValue({ id: "refund-1" });
    await createPayPalRefundForPaymentOrder({ paymentOrderId: "payment-order-1", amount: 5, requestedById: "admin-1" });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/v2/payments/captures/capture-1/refund"), expect.objectContaining({ method: "POST" }));
    expect(mockPrisma.paymentRefund.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ provider: "paypal" }) }));
  });

  it("filters payment methods by country, currency, gateway status, and Google Pay capability", async () => {
    mockPrisma.paymentGateway.findMany.mockResolvedValue([
      { ...paypalGateway(), settings: [] },
      { ...paypalGateway(), id: "gateway-stripe", provider: "stripe", supportedCountriesJson: ["US"], supportedCurrenciesJson: ["USD"], settings: [{ settingKey: "supports_google_pay_wallet", settingValueJson: true }] },
    ]);
    mockPrisma.sellerPayoutAccount.findUnique.mockResolvedValue({ status: "active", chargesEnabled: true });
    const methods = await listAvailablePaymentMethods({ countryCode: "US", currencyCode: "USD", module: PaymentModule.food_order, sellerOrganizationId: "seller-1" });
    expect(methods.find((method) => method.provider === "paypal")?.enabled).toBe(true);
    expect(methods.find((method) => method.provider === "google_pay")?.enabled).toBe(true);
    expect(methods.find((method) => method.provider === "google_pay")?.walletBackedBy).toBe(PaymentProvider.stripe);
  });

  it("keeps direct Google Pay and incomplete country gateways disabled", async () => {
    await expect(getPaymentGatewayAdapter("google_pay").createCheckoutSession({
      paymentOrderId: "pay-1",
      amount: 10,
      currencyCode: "USD",
      module: PaymentModule.food_order,
      moduleEntityId: "food-1",
      returnUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
    })).rejects.toThrow("google_pay checkout is registered but no provider SDK is connected yet");
    await expect(getPaymentGatewayAdapter("razorpay").createCheckoutSession({
      paymentOrderId: "pay-1",
      amount: 10,
      currencyCode: "INR",
      module: PaymentModule.food_order,
      moduleEntityId: "food-1",
      returnUrl: "https://example.com/ok",
      cancelUrl: "https://example.com/cancel",
    })).rejects.toThrow("razorpay checkout is registered but no provider SDK is connected yet");
  });
});
