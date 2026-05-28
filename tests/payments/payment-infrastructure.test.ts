import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    paymentGateway: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentGatewayCredential: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentConfiguration: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    paymentOrder: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    paymentTransaction: { findMany: vi.fn(), count: vi.fn() },
    paymentRefund: { findMany: vi.fn(), count: vi.fn() },
    paymentDispute: { findMany: vi.fn(), count: vi.fn() },
    sellerPayout: { findMany: vi.fn(), count: vi.fn() },
    paymentWebhookEvent: { findMany: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    ENCRYPTION_KEY: "local-test-encryption-key-that-is-long-enough",
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { PaymentGatewayStatus, PaymentModule, PaymentProvider } from "@prisma/client";
import { createAuditEvent } from "@/server/audit";
import { decryptGatewayCredential, encryptGatewayCredential, maskCredentialPreview } from "@/server/payments/credentials";
import { savePaymentGateway, savePaymentGatewayCredential, getPaymentGateway } from "@/server/payments/admin";
import { createPaymentOrderForModule } from "@/server/payments/payment-service";

function adminSession(role: string | null = "platform_owner") {
  return {
    user: { id: "admin-1", email: "admin@example.test", status: "active", platformRole: role },
    countryAssignments: [{ countryCode: "US" }],
  } as never;
}

describe("payment infrastructure", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.paymentGateway.create.mockImplementation(async ({ data }) => ({ id: "gateway-1", ...data }));
    mockPrisma.paymentGateway.update.mockImplementation(async ({ data }) => ({ id: "gateway-1", ...data }));
    mockPrisma.paymentGateway.findUnique.mockResolvedValue({
      id: "gateway-1",
      displayName: "Stripe US",
      provider: "stripe",
      status: "active",
      environment: "sandbox",
      countryCode: "US",
      supportedCountriesJson: ["US"],
      supportedCurrenciesJson: ["USD"],
      credentials: [],
      settings: [],
    });
    mockPrisma.paymentConfiguration.findUnique.mockResolvedValue({
      platformCommissionPercent: "10",
      fixedCommissionAmount: "0.50",
      taxPercent: "0",
    });
    mockPrisma.paymentOrder.findUnique.mockResolvedValue(null);
    mockPrisma.paymentOrder.create.mockImplementation(async ({ data }) => ({ id: "pay-1", status: "pending", ...data }));
  });

  it("encrypts gateway credentials and masks previews", () => {
    const encrypted = encryptGatewayCredential("provider_test_secret_1234");
    expect(encrypted).not.toContain("provider_test_secret_1234");
    expect(decryptGatewayCredential(encrypted)).toBe("provider_test_secret_1234");
    expect(maskCredentialPreview("provider_test_secret_1234")).toMatch(/\*\*\*\*1234$/);
  });

  it("super admin can create a gateway and credentials are not returned in detail views", async () => {
    await savePaymentGateway(adminSession(), {
      provider: PaymentProvider.stripe,
      displayName: "Stripe US",
      status: PaymentGatewayStatus.active,
      environment: "sandbox",
      countryCode: "US",
      supportedCountries: "US",
      supportedCurrencies: "USD",
      priority: 10,
      isDefault: true,
      isPlatformGateway: true,
    });
    expect(mockPrisma.paymentGateway.create).toHaveBeenCalled();
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "payment_gateway.created" }));

    mockPrisma.paymentGatewayCredential.findUnique.mockResolvedValue(null);
    mockPrisma.paymentGatewayCredential.create.mockResolvedValue({ id: "cred-1", keyName: "secret_key", valuePreview: "provider****1234", rotatedAt: null });
    await savePaymentGatewayCredential(adminSession(), { gatewayId: "gateway-1", keyName: "secret_key", secretValue: "provider_test_secret_1234" });
    expect(mockPrisma.paymentGatewayCredential.create.mock.calls[0][0].data.encryptedValue).not.toContain("provider_test_secret_1234");

    await getPaymentGateway(adminSession(), "gateway-1");
    const include = mockPrisma.paymentGateway.findUnique.mock.calls.at(-1)?.[0].include.credentials.select;
    expect(include.encryptedValue).toBeUndefined();
  });

  it("blocks normal users from gateway configuration", async () => {
    await expect(savePaymentGateway(adminSession(null), {
      provider: "stripe",
      displayName: "Stripe",
      countryCode: "US",
      supportedCountries: "US",
      supportedCurrencies: "USD",
    })).rejects.toThrow();
  });

  it("country manager is scoped to assigned countries", async () => {
    await expect(savePaymentGateway(adminSession("country_manager"), {
      provider: "stripe",
      displayName: "Stripe India",
      countryCode: "IN",
      supportedCountries: "IN",
      supportedCurrencies: "INR",
    })).rejects.toThrow();
  });

  it("creates payment orders with server-side fee calculation and idempotency", async () => {
    const order = await createPaymentOrderForModule({
      organizationId: "tenant-org",
      countryCode: "US",
      customerUserId: "user-1",
      module: PaymentModule.food_order,
      moduleEntityId: "food-order-1",
      provider: PaymentProvider.stripe,
      gatewayId: "gateway-1",
      amount: 100,
      currencyCode: "USD",
      idempotencyKey: "food-order-1-usd-100",
    });
    expect(order.id).toBe("pay-1");
    expect(mockPrisma.paymentOrder.create.mock.calls[0][0].data.platformFeeAmount.toString()).toBe("10.5");
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "payment_order.created" }));

    mockPrisma.paymentOrder.findUnique.mockResolvedValueOnce({ id: "pay-existing" });
    await createPaymentOrderForModule({
      organizationId: "tenant-org",
      countryCode: "US",
      module: PaymentModule.food_order,
      moduleEntityId: "food-order-1",
      amount: 100,
      currencyCode: "USD",
      idempotencyKey: "food-order-1-usd-100",
    });
    expect(mockPrisma.paymentOrder.create).toHaveBeenCalledTimes(1);
  });

  it("does not allow disabled gateways to be used", async () => {
    mockPrisma.paymentGateway.findUnique.mockResolvedValueOnce({ status: "disabled" });
    await expect(createPaymentOrderForModule({
      organizationId: "tenant-org",
      countryCode: "US",
      module: PaymentModule.food_order,
      moduleEntityId: "food-order-1",
      provider: PaymentProvider.stripe,
      gatewayId: "gateway-disabled",
      amount: 100,
      currencyCode: "USD",
      idempotencyKey: "disabled-gateway-order",
    })).rejects.toThrow("Disabled or missing payment gateways");
  });

  it("does not add raw card fields to payment admin forms", () => {
    const paymentsDir = path.join(process.cwd(), "src/app/(app)/admin/payments");
    const allFiles = walk(paymentsDir).filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"));
    const source = allFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    expect(source).not.toMatch(/name=["'](?:cardNumber|card_number|cvv|cvc)["']/i);
  });
});

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
