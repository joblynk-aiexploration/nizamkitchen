import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, PaymentModule, PaymentProvider } from "@prisma/client";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    promotion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    promotionRedemption: {
      count: vi.fn(),
      upsert: vi.fn(),
    },
    paymentConfiguration: { findUnique: vi.fn() },
    paymentGateway: { findUnique: vi.fn() },
    paymentOrder: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    platformCreditAccount: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    referralCode: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import { createAuditEvent } from "@/server/audit";
import {
  calculateNetPayable,
  createAdminPromotion,
  createSellerPromotion,
  grantPlatformCredit,
  validatePromotionForCheckout,
} from "@/server/promotions";
import { createPaymentOrderForModule } from "@/server/payments/payment-service";

const activePromotion = {
  id: "promo-1",
  code: "HYD10",
  name: "Hyderabadi launch",
  description: null,
  promotionType: "promo_code",
  discountType: "percent",
  status: "active",
  scope: "platform",
  sellerOrganizationId: null,
  countryCode: "US",
  region: null,
  city: "Dallas",
  currencyCode: "USD",
  percentOff: new Prisma.Decimal(10),
  amountOff: null,
  minOrderAmount: new Prisma.Decimal(25),
  maxDiscountAmount: new Prisma.Decimal(20),
  startsAt: null,
  endsAt: null,
  usageLimit: 5,
  perUserLimit: 1,
  appliesToFoodOrders: true,
  appliesToHomeChefRequests: true,
  appliesToSubscriptions: false,
  createdById: "owner-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function ownerSession() {
  return { user: { id: "owner-1", platformRole: "platform_owner" }, countryAssignments: [{ countryCode: "US" }] } as never;
}

function sellerSession() {
  return {
    user: { id: "seller-user" },
    activeOrganization: { id: "seller-org", organizationType: "home_catering", countryCode: "US", currencyCode: "USD" },
    activeMembership: { role: "home_catering_owner" },
  } as never;
}

describe("promotions, credits, and referrals foundation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.promotion.findUnique.mockResolvedValue(activePromotion);
    mockPrisma.promotionRedemption.count.mockResolvedValue(0);
    mockPrisma.promotionRedemption.upsert.mockResolvedValue({ id: "redemption-1" });
    mockPrisma.paymentConfiguration.findUnique.mockResolvedValue({ platformCommissionPercent: "10", fixedCommissionAmount: "0", taxPercent: "0" });
    mockPrisma.paymentOrder.findUnique.mockResolvedValue(null);
    mockPrisma.paymentOrder.create.mockImplementation(async ({ data }) => ({ id: "payment-1", ...data }));
    mockPrisma.paymentOrder.update.mockImplementation(async ({ data }) => ({ id: "payment-1", ...data }));
  });

  it("calculates promo discounts server-side and caps the discount", async () => {
    const result = await validatePromotionForCheckout({
      code: "hyd10",
      module: "food_order",
      userId: "user-1",
      organizationId: "org-1",
      sellerOrganizationId: "seller-org",
      countryCode: "US",
      city: "Dallas",
      amount: 250,
      currencyCode: "USD",
    });
    expect(result?.promotion.code).toBe("HYD10");
    expect(result?.discountAmount).toBe(20);
    expect(result?.payableAmount).toBe(230);
  });

  it("validates country city seller and usage limits before checkout", async () => {
    await expect(validatePromotionForCheckout({
      code: "HYD10",
      module: "food_order",
      userId: "user-1",
      sellerOrganizationId: "seller-org",
      countryCode: "CA",
      city: "Dallas",
      amount: 100,
      currencyCode: "USD",
    })).rejects.toThrow("country");

    await expect(validatePromotionForCheckout({
      code: "HYD10",
      module: "food_order",
      userId: "user-1",
      sellerOrganizationId: "seller-org",
      countryCode: "US",
      city: "Houston",
      amount: 100,
      currencyCode: "USD",
    })).rejects.toThrow("city");

    mockPrisma.promotionRedemption.count.mockResolvedValueOnce(5);
    await expect(validatePromotionForCheckout({
      code: "HYD10",
      module: "food_order",
      userId: "user-1",
      sellerOrganizationId: "seller-org",
      countryCode: "US",
      city: "Dallas",
      amount: 100,
      currencyCode: "USD",
    })).rejects.toThrow("usage limit");
  });

  it("ignores client discount amount and creates discounted payment orders from server rules", async () => {
    mockPrisma.promotion.findUnique.mockResolvedValueOnce({ ...activePromotion, city: null });
    await createPaymentOrderForModule({
      organizationId: "tenant-org",
      countryCode: "US",
      customerOrganizationId: "customer-org",
      customerUserId: "user-1",
      sellerOrganizationId: "seller-org",
      module: PaymentModule.food_order,
      moduleEntityId: "food-order-1",
      provider: PaymentProvider.manual,
      amount: 100,
      discountAmount: 999,
      currencyCode: "USD",
      idempotencyKey: "food-order-1-hyd10",
      promotionCode: "HYD10",
    } as never);

    const createdData = mockPrisma.paymentOrder.create.mock.calls[0][0].data;
    expect(Number(createdData.amount)).toBe(90);
    expect(Number(createdData.discountAmount)).toBe(10);
    expect(createdData.promotionCode).toBe("HYD10");
    expect(mockPrisma.promotionRedemption.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ module: "food_order", moduleEntityId: "food-order-1" }),
    }));
  });

  it("lets platform owner and eligible sellers create scoped promotions", async () => {
    mockPrisma.promotion.create.mockImplementation(async ({ data }) => ({ id: "promo-new", ...data }));
    await createAdminPromotion(ownerSession(), {
      code: "EID15",
      name: "Eid offer",
      discountType: "percent",
      percentOff: 15,
      status: "active",
      countryCode: "US",
    });
    expect(mockPrisma.promotion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ code: "EID15", scope: "platform" }),
    }));

    await createSellerPromotion(sellerSession(), {
      code: "BIRYANI5",
      name: "Biryani tray",
      discountType: "fixed_amount",
      amountOff: 5,
      status: "active",
    });
    expect(mockPrisma.promotion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        code: "BIRYANI5",
        scope: "seller",
        sellerOrganization: { connect: { id: "seller-org" } },
      }),
    }));
    expect(createAuditEvent).toHaveBeenCalled();
  });

  it("grants platform credit through an auditable ledger", async () => {
    mockPrisma.platformCreditAccount.upsert.mockResolvedValue({ id: "credit-1", balanceAmount: new Prisma.Decimal(25) });
    mockPrisma.platformCreditAccount.update.mockResolvedValue({ id: "credit-1", balanceAmount: new Prisma.Decimal(40) });
    await grantPlatformCredit(ownerSession(), { organizationId: "org-1", currencyCode: "USD", amount: 15, reason: "Referral reward" });
    expect(mockPrisma.platformCreditAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        balanceAmount: new Prisma.Decimal(40),
        ledgerEntries: { create: expect.objectContaining({ entryType: "grant", reason: "Referral reward" }) },
      }),
    }));
  });

  it("calculates net payable amounts without trusting client-side totals", () => {
    expect(calculateNetPayable(100, 12.5, 7.5)).toBe(80);
    expect(calculateNetPayable(10, 50, 0)).toBe(0);
  });
});
