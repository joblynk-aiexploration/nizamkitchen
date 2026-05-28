import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCreateAuditEvent } = vi.hoisted(() => ({
  mockCreateAuditEvent: vi.fn(),
  mockPrisma: {
    paymentOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    paymentRefund: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: mockCreateAuditEvent }));

import { createCustomerRefundRequest, listRefundablePaymentOrders, refundRemainingAmount } from "@/server/payments/refund-requests";

const memberSession = {
  user: { id: "user-1" },
  activeOrganization: { id: "org-1", countryCode: "US", currencyCode: "USD" },
};

describe("customer refund requests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCreateAuditEvent.mockResolvedValue({ id: "audit-1" });
    mockPrisma.paymentRefund.create.mockResolvedValue({ id: "refund-1" });
  });

  it("calculates remaining refundable amount excluding failed and cancelled refunds", () => {
    const remaining = refundRemainingAmount({
      amount: new Prisma.Decimal(100),
      refunds: [
        { status: "succeeded", amount: new Prisma.Decimal(25) },
        { status: "failed", amount: new Prisma.Decimal(25) },
        { status: "cancelled", amount: new Prisma.Decimal(15) },
      ],
    });

    expect(remaining).toBe(75);
  });

  it("lists only paid member payments with remaining refundable balance", async () => {
    mockPrisma.paymentOrder.findMany.mockResolvedValue([
      {
        id: "order-1",
        amount: new Prisma.Decimal(50),
        refunds: [],
        accountingDocuments: [],
      },
      {
        id: "order-2",
        amount: new Prisma.Decimal(30),
        refunds: [{ status: "succeeded", amount: new Prisma.Decimal(30) }],
        accountingDocuments: [],
      },
    ]);

    const orders = await listRefundablePaymentOrders(memberSession);

    expect(mockPrisma.paymentOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: { in: ["paid", "partially_refunded"] },
      }),
    }));
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ id: "order-1", remainingRefundAmount: 50 });
  });

  it("creates a requested refund record for the member payment instead of a support ticket", async () => {
    mockPrisma.paymentOrder.findFirst.mockResolvedValue({
      id: "order-1",
      organizationId: "org-1",
      countryCode: "US",
      provider: "stripe",
      gatewayId: "gateway-1",
      status: "paid",
      amount: new Prisma.Decimal(50),
      currencyCode: "USD",
      refunds: [],
    });

    await createCustomerRefundRequest(memberSession, {
      paymentOrderId: "order-1",
      amount: 20,
      reason: "Accidental duplicate purchase",
    });

    expect(mockPrisma.paymentRefund.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        paymentOrderId: "order-1",
        status: "requested",
        amount: expect.any(Prisma.Decimal),
        reason: "Accidental duplicate purchase",
        requestedById: "user-1",
      }),
    }));
    expect(mockCreateAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: "payment_refund.customer_requested",
      targetType: "payment_refund",
    }));
  });

  it("blocks duplicate open refund reviews", async () => {
    mockPrisma.paymentOrder.findFirst.mockResolvedValue({
      id: "order-1",
      organizationId: "org-1",
      countryCode: "US",
      provider: "stripe",
      gatewayId: "gateway-1",
      status: "paid",
      amount: new Prisma.Decimal(50),
      currencyCode: "USD",
      refunds: [{ status: "requested", amount: new Prisma.Decimal(10) }],
    });

    await expect(createCustomerRefundRequest(memberSession, {
      paymentOrderId: "order-1",
      amount: 20,
      reason: "Need review",
    })).rejects.toThrow("already open");
  });
});
