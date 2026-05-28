import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    paymentOrder: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    paymentRefund: { findMany: vi.fn() },
    paymentDispute: { findMany: vi.fn() },
    paymentTransaction: { findMany: vi.fn(), create: vi.fn() },
    paymentWebhookEvent: { findMany: vi.fn() },
    sellerPayout: { findMany: vi.fn() },
    sellerPayoutAccount: { findFirst: vi.fn() },
    foodOrder: { updateMany: vi.fn() },
    homeChefRequest: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));

import {
  exportPaymentsCsv,
  getCommissionReport,
  getPaymentOperationsDashboard,
  getSellerPaymentSummary,
  markManualPaymentStatus,
  syncModulePaymentStatus,
  validateRefundAmount,
} from "@/server/payments/operations";

function session(role = "platform_owner") {
  return {
    user: { id: "admin-1", email: "admin@example.test", status: "active", platformRole: role },
    countryAssignments: [{ countryCode: "US" }],
  } as never;
}

describe("payment operations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.paymentOrder.findMany.mockResolvedValue([]);
    mockPrisma.paymentRefund.findMany.mockResolvedValue([]);
    mockPrisma.paymentDispute.findMany.mockResolvedValue([]);
    mockPrisma.paymentTransaction.findMany.mockResolvedValue([]);
    mockPrisma.paymentWebhookEvent.findMany.mockResolvedValue([]);
    mockPrisma.sellerPayout.findMany.mockResolvedValue([]);
    mockPrisma.sellerPayoutAccount.findFirst.mockResolvedValue(null);
    mockPrisma.paymentOrder.update.mockImplementation(async ({ data }) => ({ id: "payment-order-1", ...data }));
  });

  it("blocks refunds that exceed the remaining paid amount", async () => {
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      status: "paid",
      amount: new Prisma.Decimal(100),
      refunds: [{ status: "succeeded", amount: new Prisma.Decimal(90) }],
    });
    await expect(validateRefundAmount("payment-order-1", 20)).rejects.toThrow("cannot exceed");
  });

  it("blocks duplicate refunds after an order is fully refunded", async () => {
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      status: "refunded",
      amount: new Prisma.Decimal(100),
      refunds: [{ status: "succeeded", amount: new Prisma.Decimal(100) }],
    });
    await expect(validateRefundAmount("payment-order-1", 1)).rejects.toThrow("already been fully refunded");
  });

  it("syncs module payment status to food orders and home chef requests", async () => {
    await syncModulePaymentStatus("payment-order-1", "partially_refunded");
    expect(mockPrisma.foodOrder.updateMany).toHaveBeenCalledWith({ where: { paymentOrderId: "payment-order-1" }, data: { paymentStatus: "partially_refunded" } });
    expect(mockPrisma.homeChefRequest.updateMany).toHaveBeenCalledWith({ where: { paymentOrderId: "payment-order-1" }, data: { paymentStatus: "partially_refunded" } });
  });

  it("requires platform admin permission for manual reconciliation", async () => {
    await expect(markManualPaymentStatus({ session: session(null as never), paymentOrderId: "payment-order-1", status: "paid" })).rejects.toThrow();
  });

  it("marks manual payments paid with audit and module sync", async () => {
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue({
      id: "payment-order-1",
      provider: "manual",
      organizationId: "org-1",
      countryCode: "US",
      gatewayId: null,
      amount: new Prisma.Decimal(25),
      currencyCode: "USD",
    });
    await markManualPaymentStatus({ session: session(), paymentOrderId: "payment-order-1", status: "paid", note: "cash received" });
    expect(mockPrisma.paymentTransaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "succeeded", transactionType: "charge" }) }));
    expect(mockPrisma.foodOrder.updateMany).toHaveBeenCalled();
  });

  it("calculates commissions from server-side payment orders and refunds", async () => {
    mockPrisma.paymentOrder.findMany.mockResolvedValue([
      { sellerOrganizationId: "seller-1", amount: new Prisma.Decimal(100), platformFeeAmount: new Prisma.Decimal(12), sellerAmount: new Prisma.Decimal(88) },
      { sellerOrganizationId: "seller-1", amount: new Prisma.Decimal(50), platformFeeAmount: new Prisma.Decimal(6), sellerAmount: new Prisma.Decimal(44) },
    ]);
    mockPrisma.paymentRefund.findMany.mockResolvedValue([
      { amount: new Prisma.Decimal(10), paymentOrder: { sellerOrganizationId: "seller-1" } },
    ]);
    const report = await getCommissionReport(session());
    expect(report[0]).toMatchObject({ sellerOrganizationId: "seller-1", grossSales: 150, platformCommission: 18, refunds: 10, sellerNet: 122 });
  });

  it("limits seller payout summaries to the requested seller organization", async () => {
    await getSellerPaymentSummary("seller-1");
    expect(mockPrisma.paymentOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { sellerOrganizationId: "seller-1" } }));
    expect(mockPrisma.sellerPayout.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "seller-1" } }));
  });

  it("protects the operations dashboard and summarizes failed/high-risk activity", async () => {
    await expect(getPaymentOperationsDashboard(session(null as never))).rejects.toThrow();
    mockPrisma.paymentOrder.findMany.mockResolvedValue([{ status: "failed", amount: new Prisma.Decimal(20), provider: "stripe", countryCode: "US", module: "food_order" }]);
    mockPrisma.paymentWebhookEvent.findMany.mockResolvedValue([{ id: "evt-failed", status: "failed" }]);
    const dashboard = await getPaymentOperationsDashboard(session());
    expect(dashboard.failedPayments).toBe(1);
    expect(dashboard.failedEvents).toHaveLength(1);
  });

  it("exports CSV without raw provider JSON or secrets", async () => {
    mockPrisma.paymentTransaction.findMany.mockResolvedValue([
      {
        id: "txn-1",
        paymentOrderId: "payment-order-1",
        provider: "stripe",
        transactionType: "charge",
        status: "succeeded",
        amount: new Prisma.Decimal(25),
        currencyCode: "USD",
        providerRawJson: { secret: "provider_secret_should_not_export" },
        createdAt: new Date("2026-05-19T00:00:00.000Z"),
      },
    ]);
    const csv = await exportPaymentsCsv(session(), "transactions");
    expect(csv).toContain("payment-order-1");
    expect(csv).not.toContain("provider_secret_should_not_export");
    expect(csv).not.toContain("providerRawJson");
  });
});
