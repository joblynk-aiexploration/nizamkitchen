import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentOrderStatus, PaymentProvider, UserStatus, type PlatformRole } from "@prisma/client";
import { Prisma } from "@prisma/client";

const { mockPrisma, createAuditEvent } = vi.hoisted(() => ({
  mockPrisma: {
    taxConfiguration: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    accountingDocument: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    commissionRecord: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    sellerSettlementReport: { findMany: vi.fn(), create: vi.fn() },
    paymentOrder: { findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
  },
  createAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));

import {
  exportAccountingCsv,
  generateAccountingForPaidOrders,
  generateAccountingForPaymentOrder,
  listMemberAccountingDocuments,
  upsertTaxConfiguration,
} from "@/server/accounting/accounting-service";

function session(role: PlatformRole | null = "platform_owner") {
  return {
    user: { id: "admin-1", email: "admin@example.test", status: UserStatus.active, platformRole: role },
    countryAssignments: [{ countryCode: "US" }],
  } as never;
}

const paidOrder = {
  id: "payment-order-abc12345",
  organizationId: "platform-org",
  countryCode: "US",
  customerOrganizationId: "customer-org",
  customerUserId: "user-1",
  sellerOrganizationId: "seller-org",
  module: "food_order",
  moduleEntityId: "food-1",
  provider: PaymentProvider.stripe,
  gatewayId: "gateway-1",
  status: PaymentOrderStatus.paid,
  amount: new Prisma.Decimal(120),
  currencyCode: "USD",
  platformFeeAmount: new Prisma.Decimal(12),
  sellerAmount: new Prisma.Decimal(100),
  taxAmount: new Prisma.Decimal(8),
  paidAt: new Date("2026-05-01T12:00:00.000Z"),
  createdAt: new Date("2026-05-01T11:00:00.000Z"),
};

describe("accounting records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.taxConfiguration.create.mockImplementation(async ({ data }) => ({ id: "tax-1", createdAt: new Date(), updatedAt: new Date(), ...data }));
    mockPrisma.accountingDocument.findUnique.mockResolvedValue(null);
    mockPrisma.accountingDocument.create.mockImplementation(async ({ data }) => ({ id: `doc-${data.documentType}`, createdAt: new Date(), updatedAt: new Date(), ...data }));
    mockPrisma.commissionRecord.findUnique.mockResolvedValue(null);
    mockPrisma.commissionRecord.create.mockImplementation(async ({ data }) => ({ id: "commission-1", createdAt: new Date(), updatedAt: new Date(), ...data }));
    mockPrisma.paymentOrder.findUniqueOrThrow.mockResolvedValue(paidOrder);
    mockPrisma.paymentOrder.findMany.mockResolvedValue([paidOrder]);
    mockPrisma.accountingDocument.findMany.mockResolvedValue([]);
    mockPrisma.commissionRecord.findMany.mockResolvedValue([]);
    mockPrisma.sellerSettlementReport.findMany.mockResolvedValue([]);
  });

  it("creates tax configuration only from explicit Platform Owner settings", async () => {
    await upsertTaxConfiguration(session(), {
      name: "Configured US placeholder",
      countryCode: "US",
      currencyCode: "USD",
      module: "food_order",
      mode: "flat_percent",
      taxPercent: "8.25",
      fixedTaxAmount: null,
      status: "active",
    });

    expect(mockPrisma.taxConfiguration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mode: "flat_percent", countryCode: "US", currencyCode: "USD" }),
    }));
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "tax_configuration.created" }));
  });

  it("blocks non-admin users from managing tax configuration", async () => {
    await expect(upsertTaxConfiguration(session(null), {
      name: "Blocked",
      mode: "manual",
      status: "draft",
    })).rejects.toThrow();
  });

  it("generates invoice, receipt, and commission records from a paid payment order", async () => {
    const result = await generateAccountingForPaymentOrder(paidOrder.id, "admin-1");

    expect(result).toEqual({ documentsCreated: 2, commissionsCreated: 1 });
    expect(mockPrisma.accountingDocument.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.accountingDocument.create.mock.calls[0][0].data).toMatchObject({
      customerOrganizationId: "customer-org",
      sellerOrganizationId: "seller-org",
      totalAmount: paidOrder.amount,
      taxAmount: paidOrder.taxAmount,
    });
    expect(mockPrisma.commissionRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ platformFeeAmount: paidOrder.platformFeeAmount, sellerAmount: paidOrder.sellerAmount }),
    }));
  });

  it("batch generation processes only paid accounting-supported payment orders", async () => {
    const result = await generateAccountingForPaidOrders(session());

    expect(mockPrisma.paymentOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ["paid", "partially_refunded", "refunded"] } }),
    }));
    expect(result.documentsCreated).toBe(2);
  });

  it("member invoice listing is scoped to the active organization", async () => {
    await listMemberAccountingDocuments({ user: { id: "user-1" }, activeOrganization: { id: "org-1" } }, "invoice");
    expect(mockPrisma.accountingDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          { organizationId: "org-1" },
          { customerOrganizationId: "org-1" },
          { sellerOrganizationId: "org-1" },
        ]),
      }),
    }));
  });

  it("accounting CSV exports exclude secrets and raw card data", async () => {
    mockPrisma.accountingDocument.findMany.mockResolvedValue([
      {
        documentNumber: "INV-US-1",
        documentType: "invoice",
        status: "issued",
        paymentOrderId: "po-1",
        countryCode: "US",
        currencyCode: "USD",
        subtotalAmount: new Prisma.Decimal(100),
        taxAmount: new Prisma.Decimal(8),
        totalAmount: new Prisma.Decimal(108),
        issuedAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    ]);
    const csv = await exportAccountingCsv(session(), "invoices");
    expect(csv).toContain("documentNumber,documentType,status");
    expect(csv).not.toContain("card");
    expect(csv).not.toContain("secret");
    expect(csv).not.toContain("providerRawJson");
  });
});
