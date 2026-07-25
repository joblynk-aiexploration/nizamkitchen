import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    feePolicy: { findMany: vi.fn() },
    taxConfiguration: { findFirst: vi.fn() },
    paymentConfiguration: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/promotions", () => ({
  applyPromotionToAmount: vi.fn().mockResolvedValue({
    evaluation: null,
    discountAmount: 0,
    payableAmount: 0,
  }),
}));

import { PricingFulfillmentType, PricingModule, PricingSellerType } from "@prisma/client";
import { calculateCheckoutQuote } from "@/server/pricing";

const policy = {
  id: "policy-1",
  name: "US food order default pricing",
  rules: [
    {
      id: "service-rule",
      feeType: "platform_service_fee",
      calculationType: "percentage",
      percentage: 10,
      fixedAmount: null,
      minAmount: 2.5,
      maxAmount: 6.5,
      thresholdAmount: null,
      displayName: "Service fee",
      isActive: true,
    },
    {
      id: "delivery-rule",
      feeType: "delivery_fee",
      calculationType: "fixed",
      percentage: null,
      fixedAmount: 3.99,
      minAmount: null,
      maxAmount: null,
      thresholdAmount: null,
      displayName: "Delivery fee",
      isActive: true,
    },
    {
      id: "small-order-rule",
      feeType: "small_order_fee",
      calculationType: "threshold_based",
      percentage: null,
      fixedAmount: 2.99,
      minAmount: null,
      maxAmount: null,
      thresholdAmount: 15,
      displayName: "Small order fee",
      isActive: true,
    },
    {
      id: "commission-rule",
      feeType: "platform_commission",
      calculationType: "percentage",
      percentage: 15,
      fixedAmount: null,
      minAmount: null,
      maxAmount: null,
      thresholdAmount: null,
      displayName: "Platform commission",
      isActive: true,
    },
  ],
};

describe("checkout pricing engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.feePolicy.findMany.mockResolvedValue([policy]);
    mockPrisma.taxConfiguration.findFirst.mockResolvedValue(null);
    mockPrisma.paymentConfiguration.findUnique.mockResolvedValue(null);
  });

  it("calculates food order service, delivery, small order, tip, commission, and total server-side", async () => {
    const quote = await calculateCheckoutQuote({
      module: PricingModule.food_order,
      customerUserId: "user-1",
      customerOrganizationId: "org-1",
      sellerOrganizationId: "seller-1",
      countryCode: "US",
      currencyCode: "USD",
      city: "Frisco",
      region: "TX",
      fulfillmentType: PricingFulfillmentType.delivery,
      sellerType: PricingSellerType.home_catering,
      items: [{ name: "Biryani tray", quantity: 1, unitAmount: 10 }],
      tipPercent: 20,
    });

    expect(quote.subtotal).toBe(10);
    expect(quote.serviceFee).toBe(2.5);
    expect(quote.deliveryFee).toBe(3.99);
    expect(quote.smallOrderFee).toBe(2.99);
    expect(quote.tipAmount).toBe(2);
    expect(quote.platformCommissionAmount).toBe(1.8);
    expect(quote.sellerAmount).toBe(10.2);
    expect(quote.totalAmount).toBe(21.48);
    expect(quote.warnings).toContain("Add $5.00 more to avoid the small order fee.");
  });

  it("removes delivery and small order fees when subscription benefits qualify", async () => {
    const quote = await calculateCheckoutQuote({
      module: PricingModule.food_order,
      customerUserId: "user-1",
      customerOrganizationId: "org-1",
      countryCode: "US",
      currencyCode: "USD",
      fulfillmentType: PricingFulfillmentType.delivery,
      sellerType: PricingSellerType.restaurant,
      items: [{ name: "Family meal", quantity: 1, unitAmount: 40 }],
      userSubscriptionPlan: {
        slug: "nizam-plus",
        benefitsJson: {
          freeDeliveryThreshold: 15,
          serviceFeeDiscountPercent: 50,
          waiveSmallOrderFee: true,
        },
      },
    });

    expect(quote.deliveryFee).toBe(0);
    expect(quote.serviceFee).toBe(2);
    expect(quote.smallOrderFee).toBe(0);
    expect(quote.totalAmount).toBe(42);
  });
});
