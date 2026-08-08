import { AccountingDocumentType, PaymentOrderStatus, Prisma, type CheckoutQuoteLine, type PlatformRole, type UserStatus } from "@prisma/client";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { paginatedQuery } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";

type AccountingSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

type MemberSession = {
  user: { id: string };
  activeOrganization: { id: string };
};

const VIEW_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"];
const MANAGE_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

export type AccountingFilters = {
  countryCode?: string;
  status?: string;
  documentType?: string;
  sellerOrganizationId?: string;
  customerOrganizationId?: string;
  page?: string | string[] | number;
  pageSize?: string | string[] | number;
};

export function assertAccountingAccess(session: AccountingSession) {
  assertPlatformRole(session.user.platformRole, VIEW_ROLES);
}

export function assertAccountingManageAccess(session: AccountingSession) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);
}

export async function getAccountingDashboard(session: AccountingSession, filters: AccountingFilters = {}) {
  assertAccountingAccess(session);
  const documentWhere = accountingDocumentWhere(session, filters);
  const [documents, commissions, settlements, taxes] = await Promise.all([
    prisma.accountingDocument.findMany({ where: documentWhere, orderBy: { issuedAt: "desc" }, take: 250 }),
    prisma.commissionRecord.findMany({ where: commissionWhere(session, filters), orderBy: { earnedAt: "desc" }, take: 250 }),
    prisma.sellerSettlementReport.findMany({ where: settlementWhere(session, filters), orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.taxConfiguration.findMany({ where: taxWhere(session, filters), orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);

  return {
    invoiceCount: documents.filter((doc) => doc.documentType === "invoice").length,
    receiptCount: documents.filter((doc) => doc.documentType === "receipt").length,
    grossInvoiced: sumDecimal(documents.filter((doc) => doc.documentType === "invoice" && doc.status === "issued").map((doc) => doc.totalAmount)),
    grossReceipts: sumDecimal(documents.filter((doc) => doc.documentType === "receipt" && doc.status === "issued").map((doc) => doc.totalAmount)),
    taxTotal: sumDecimal(documents.map((doc) => doc.taxAmount)),
    platformRevenue: sumDecimal(commissions.map((record) => record.platformFeeAmount)),
    sellerSettlements: sumDecimal(settlements.map((settlement) => settlement.sellerNetAmount)),
    openTaxConfigurations: taxes.filter((tax) => tax.status === "active").length,
    recentDocuments: documents.slice(0, 10),
    recentCommissions: commissions.slice(0, 10),
    recentSettlements: settlements.slice(0, 10),
    taxes,
  };
}

export async function listTaxConfigurations(session: AccountingSession, filters: AccountingFilters = {}) {
  assertAccountingAccess(session);
  return prisma.taxConfiguration.findMany({ where: taxWhere(session, filters), orderBy: [{ status: "asc" }, { countryCode: "asc" }, { updatedAt: "desc" }] });
}

export async function upsertTaxConfiguration(session: AccountingSession, input: {
  id?: string | null;
  name: string;
  countryCode?: string | null;
  region?: string | null;
  currencyCode?: string | null;
  module?: string | null;
  mode: "disabled" | "flat_percent" | "manual";
  taxPercent?: string | number | null;
  fixedTaxAmount?: string | number | null;
  status: "draft" | "active" | "disabled" | "archived";
  notes?: string | null;
}) {
  assertAccountingManageAccess(session);
  if (input.countryCode) assertCountryAccessIfNeeded(session, input.countryCode);
  const data = {
    name: input.name.trim(),
    countryCode: input.countryCode?.trim().toUpperCase() || null,
    region: input.region?.trim() || null,
    currencyCode: input.currencyCode?.trim().toUpperCase() || null,
    module: input.module ? input.module as never : null,
    mode: input.mode,
    taxPercent: input.taxPercent ? new Prisma.Decimal(input.taxPercent) : null,
    fixedTaxAmount: input.fixedTaxAmount ? new Prisma.Decimal(input.fixedTaxAmount) : null,
    status: input.status,
    notes: input.notes?.trim() || null,
    updatedById: session.user.id,
  };
  const tax = input.id
    ? await prisma.taxConfiguration.update({ where: { id: input.id }, data })
    : await prisma.taxConfiguration.create({ data: { ...data, createdById: session.user.id } });

  await createAuditEvent({
    actorUserId: session.user.id,
    countryCode: tax.countryCode,
    action: input.id ? "tax_configuration.updated" : "tax_configuration.created",
    targetType: "tax_configuration",
    targetId: tax.id,
    details: { mode: tax.mode, status: tax.status, taxPercent: tax.taxPercent?.toString() ?? null },
  });

  return tax;
}

export async function listAccountingDocuments(session: AccountingSession, filters: AccountingFilters = {}) {
  assertAccountingAccess(session);
  return prisma.accountingDocument.findMany({
    where: accountingDocumentWhere(session, filters),
    include: { paymentOrder: true, organization: { select: { id: true, name: true } } },
    orderBy: { issuedAt: "desc" },
    take: 500,
  });
}

export async function listAccountingDocumentsPage(session: AccountingSession, filters: AccountingFilters = {}) {
  assertAccountingAccess(session);
  const where = accountingDocumentWhere(session, filters);

  return paginatedQuery(
    prisma.accountingDocument.count({ where }),
    ({ skip, take }) =>
      prisma.accountingDocument.findMany({
        where,
        include: { paymentOrder: true, organization: { select: { id: true, name: true } } },
        orderBy: { issuedAt: "desc" },
        skip,
        take,
      }),
    { page: filters.page, pageSize: filters.pageSize },
  );
}

export async function listCommissionRecords(session: AccountingSession, filters: AccountingFilters = {}) {
  assertAccountingAccess(session);
  return prisma.commissionRecord.findMany({
    where: commissionWhere(session, filters),
    include: { paymentOrder: true },
    orderBy: { earnedAt: "desc" },
    take: 500,
  });
}

export async function listSettlementReports(session: AccountingSession, filters: AccountingFilters = {}) {
  assertAccountingAccess(session);
  return prisma.sellerSettlementReport.findMany({
    where: settlementWhere(session, filters),
    include: { sellerOrganization: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export async function listMemberAccountingDocuments(session: MemberSession, documentType?: "invoice" | "receipt") {
  return prisma.accountingDocument.findMany({
    where: {
      documentType,
      OR: [
        { organizationId: session.activeOrganization.id },
        { customerOrganizationId: session.activeOrganization.id },
        { sellerOrganizationId: session.activeOrganization.id },
      ],
    },
    include: { paymentOrder: true },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });
}

export async function listMemberAccountingDocumentsPage(
  session: MemberSession,
  documentType?: "invoice" | "receipt",
  params: { page?: string | string[] | number; pageSize?: string | string[] | number } = {},
) {
  const where = {
    documentType,
    OR: [
      { organizationId: session.activeOrganization.id },
      { customerOrganizationId: session.activeOrganization.id },
      { sellerOrganizationId: session.activeOrganization.id },
    ],
  };

  return paginatedQuery(
    prisma.accountingDocument.count({ where }),
    ({ skip, take }) =>
      prisma.accountingDocument.findMany({
        where,
        include: { paymentOrder: true },
        orderBy: { issuedAt: "desc" },
        skip,
        take,
      }),
    params,
  );
}

export async function getMemberAccountingDocument(session: MemberSession, documentId: string, documentType?: "invoice" | "receipt") {
  const document = await prisma.accountingDocument.findFirst({
    where: {
      id: documentId,
      documentType,
      OR: [
        { organizationId: session.activeOrganization.id },
        { customerOrganizationId: session.activeOrganization.id },
        { sellerOrganizationId: session.activeOrganization.id },
      ],
    },
    include: {
      paymentOrder: true,
      organization: { select: { id: true, name: true, countryCode: true, currencyCode: true } },
    },
  });
  return hydrateAccountingDocumentParties(document);
}

export async function getAccountingDocument(session: AccountingSession, documentId: string, documentType?: "invoice" | "receipt") {
  assertAccountingAccess(session);
  const document = await prisma.accountingDocument.findFirst({
    where: {
      ...accountingDocumentWhere(session, { documentType }),
      id: documentId,
    },
    include: {
      paymentOrder: true,
      organization: { select: { id: true, name: true, countryCode: true, currencyCode: true } },
    },
  });
  return hydrateAccountingDocumentParties(document);
}

type HydrationAdditions = {
  customerOrganizationName: string | null;
  sellerOrganizationName: string | null;
  checkoutQuoteLines: CheckoutQuoteLine[];
};

async function hydrateAccountingDocumentParties<T extends {
  customerOrganizationId: string | null;
  sellerOrganizationId: string | null;
  paymentOrder?: { checkoutQuoteId?: string | null } | null;
} | null>(document: T): Promise<(NonNullable<T> & HydrationAdditions) | null> {
  if (!document) return null;
  const organizationIds = [document.customerOrganizationId, document.sellerOrganizationId].filter(Boolean) as string[];
  const [organizations, checkoutQuote] = await Promise.all([
    organizationIds.length
      ? prisma.organization.findMany({
          where: { id: { in: organizationIds } },
          select: { id: true, name: true },
        })
      : [],
    document.paymentOrder?.checkoutQuoteId
      ? prisma.checkoutQuote.findUnique({
          where: { id: document.paymentOrder.checkoutQuoteId },
          include: { lines: { orderBy: { sortOrder: "asc" } } },
        })
      : null,
  ]);
  const nameById = new Map(organizations.map((organization) => [organization.id, organization.name]));

  return {
    ...document,
    customerOrganizationName: document.customerOrganizationId ? nameById.get(document.customerOrganizationId) ?? null : null,
    sellerOrganizationName: document.sellerOrganizationId ? nameById.get(document.sellerOrganizationId) ?? null : null,
    checkoutQuoteLines: checkoutQuote?.lines ?? [],
  } as NonNullable<T> & HydrationAdditions;
}

export async function listSellerSettlementReports(organizationId: string) {
  return prisma.sellerSettlementReport.findMany({
    where: { sellerOrganizationId: organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function generateAccountingForPaidOrders(session: AccountingSession) {
  assertAccountingManageAccess(session);
  const orders = await prisma.paymentOrder.findMany({
    where: {
      ...paymentOrderCountryWhere(session),
      status: { in: [PaymentOrderStatus.paid, PaymentOrderStatus.partially_refunded, PaymentOrderStatus.refunded] },
      module: { in: ["food_order", "home_chef_request", "subscription"] },
    },
    orderBy: { paidAt: "desc" },
    take: 500,
  });

  let documentsCreated = 0;
  let commissionsCreated = 0;
  for (const order of orders) {
    const result = await generateAccountingForPaymentOrder(order.id, session.user.id);
    documentsCreated += result.documentsCreated;
    commissionsCreated += result.commissionsCreated;
  }

  await createAuditEvent({
    actorUserId: session.user.id,
    action: "accounting_records.generated",
    targetType: "accounting",
    details: { orders: orders.length, documentsCreated, commissionsCreated },
  });

  return { orders: orders.length, documentsCreated, commissionsCreated };
}

export async function generateAccountingForPaymentOrder(paymentOrderId: string, actorUserId?: string | null) {
  const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: paymentOrderId } });
  if (!["paid", "partially_refunded", "refunded"].includes(order.status)) {
    throw new Error("Accounting records can only be generated for paid or refunded payment orders.");
  }
  const checkoutQuote = order.checkoutQuoteId
    ? await prisma.checkoutQuote.findUnique({
        where: { id: order.checkoutQuoteId },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      })
    : null;

  let documentsCreated = 0;
  let commissionsCreated = 0;
  for (const documentType of [AccountingDocumentType.invoice, AccountingDocumentType.receipt]) {
    const exists = await prisma.accountingDocument.findUnique({
      where: { paymentOrderId_documentType: { paymentOrderId: order.id, documentType } },
    });
    if (!exists) {
      await prisma.accountingDocument.create({
        data: {
          documentNumber: buildDocumentNumber(documentType, order),
          documentType,
          status: "issued",
          paymentOrderId: order.id,
          organizationId: order.organizationId,
          customerOrganizationId: order.customerOrganizationId,
          sellerOrganizationId: order.sellerOrganizationId,
          countryCode: order.countryCode,
          currencyCode: order.currencyCode,
          subtotalAmount: checkoutQuote?.subtotalAmount ?? order.amount.minus(order.taxAmount ?? new Prisma.Decimal(0)),
          taxAmount: checkoutQuote?.taxAmount ?? order.taxAmount ?? new Prisma.Decimal(0),
          totalAmount: checkoutQuote?.totalAmount ?? order.amount,
          platformFeeAmount: order.platformFeeAmount,
          sellerAmount: order.sellerAmount,
          metadataJson: {
            module: order.module,
            moduleEntityId: order.moduleEntityId,
            checkoutQuoteId: order.checkoutQuoteId,
            pdfStorage: "S3 PDF attachment can be linked via pdfFileId when generated by a PDF worker.",
          },
        },
      });
      documentsCreated += 1;
    }
  }

  const commissionExists = await prisma.commissionRecord.findUnique({ where: { paymentOrderId: order.id } });
  if (!commissionExists) {
    await prisma.commissionRecord.create({
      data: {
        paymentOrderId: order.id,
        sellerOrganizationId: order.sellerOrganizationId,
        countryCode: order.countryCode,
        currencyCode: order.currencyCode,
        grossAmount: order.amount,
        platformFeeAmount: order.platformFeeAmount ?? new Prisma.Decimal(0),
        sellerAmount: order.sellerAmount ?? new Prisma.Decimal(0),
        taxAmount: order.taxAmount ?? new Prisma.Decimal(0),
        status: order.status === "refunded" ? "reversed" : "earned",
        reversedAt: order.status === "refunded" ? new Date() : null,
      },
    });
    commissionsCreated += 1;
  }

  if (actorUserId) {
    await createAuditEvent({
      actorUserId,
      organizationId: order.organizationId,
      countryCode: order.countryCode,
      action: "payment_order.accounting_generated",
      targetType: "payment_order",
      targetId: order.id,
      details: { documentsCreated, commissionsCreated },
    });
  }

  return { documentsCreated, commissionsCreated };
}

export async function generateSellerSettlementReports(session: AccountingSession, periodStart: Date, periodEnd: Date) {
  assertAccountingManageAccess(session);
  const orders = await prisma.paymentOrder.findMany({
    where: {
      ...paymentOrderCountryWhere(session),
      status: { in: ["paid", "partially_refunded"] },
      sellerOrganizationId: { not: null },
      paidAt: { gte: periodStart, lte: periodEnd },
    },
    include: { refunds: true },
    take: 1000,
  });
  const bySeller = new Map<string, typeof orders>();
  for (const order of orders) {
    if (!order.sellerOrganizationId) continue;
    bySeller.set(order.sellerOrganizationId, [...(bySeller.get(order.sellerOrganizationId) ?? []), order]);
  }

  let created = 0;
  for (const [sellerOrganizationId, sellerOrders] of bySeller.entries()) {
    const first = sellerOrders[0];
    const refundAmount = sumDecimal(sellerOrders.flatMap((order) => order.refunds.filter((refund) => refund.status !== "failed" && refund.status !== "cancelled").map((refund) => refund.amount)));
    await prisma.sellerSettlementReport.create({
      data: {
        sellerOrganizationId,
        countryCode: first.countryCode,
        currencyCode: first.currencyCode,
        periodStart,
        periodEnd,
        status: "pending",
        grossAmount: new Prisma.Decimal(sumDecimal(sellerOrders.map((order) => order.amount))),
        platformFeeAmount: new Prisma.Decimal(sumDecimal(sellerOrders.map((order) => order.platformFeeAmount))),
        refundAmount: new Prisma.Decimal(refundAmount),
        sellerNetAmount: new Prisma.Decimal(Math.max(0, sumDecimal(sellerOrders.map((order) => order.sellerAmount)) - refundAmount)),
        generatedById: session.user.id,
      },
    });
    created += 1;
  }
  return { created };
}

export async function exportAccountingCsv(session: AccountingSession, type: "invoices" | "receipts" | "commissions" | "settlements" | "taxes") {
  assertAccountingAccess(session);
  if (type === "taxes") {
    return toCsv(["id", "name", "countryCode", "currencyCode", "module", "mode", "taxPercent", "status"], await listTaxConfigurations(session));
  }
  if (type === "commissions") {
    return toCsv(["id", "paymentOrderId", "sellerOrganizationId", "countryCode", "grossAmount", "platformFeeAmount", "sellerAmount", "taxAmount", "status", "earnedAt"], await listCommissionRecords(session));
  }
  if (type === "settlements") {
    return toCsv(["id", "sellerOrganizationId", "countryCode", "currencyCode", "periodStart", "periodEnd", "grossAmount", "platformFeeAmount", "refundAmount", "sellerNetAmount", "status"], await listSettlementReports(session));
  }
  const documentType = type === "invoices" ? "invoice" : "receipt";
  return toCsv(["documentNumber", "documentType", "status", "paymentOrderId", "countryCode", "currencyCode", "subtotalAmount", "taxAmount", "totalAmount", "issuedAt"], await listAccountingDocuments(session, { documentType }));
}

function accountingDocumentWhere(session: AccountingSession, filters: AccountingFilters = {}): Prisma.AccountingDocumentWhereInput {
  return {
    ...countryScopedWhere(session, filters.countryCode),
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.documentType ? { documentType: filters.documentType as never } : {}),
    ...(filters.sellerOrganizationId ? { sellerOrganizationId: filters.sellerOrganizationId } : {}),
    ...(filters.customerOrganizationId ? { customerOrganizationId: filters.customerOrganizationId } : {}),
  };
}

function commissionWhere(session: AccountingSession, filters: AccountingFilters = {}): Prisma.CommissionRecordWhereInput {
  return {
    ...countryScopedWhere(session, filters.countryCode),
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.sellerOrganizationId ? { sellerOrganizationId: filters.sellerOrganizationId } : {}),
  };
}

function settlementWhere(session: AccountingSession, filters: AccountingFilters = {}): Prisma.SellerSettlementReportWhereInput {
  return {
    ...countryScopedWhere(session, filters.countryCode),
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.sellerOrganizationId ? { sellerOrganizationId: filters.sellerOrganizationId } : {}),
  };
}

function taxWhere(session: AccountingSession, filters: AccountingFilters = {}): Prisma.TaxConfigurationWhereInput {
  return countryScopedWhere(session, filters.countryCode);
}

function paymentOrderCountryWhere(session: AccountingSession): Prisma.PaymentOrderWhereInput {
  return countryScopedWhere(session);
}

function countryScopedWhere(session: AccountingSession, explicitCountryCode?: string): { countryCode?: string | { in: string[] } } {
  if (session.user.platformRole === "country_manager") {
    const assigned = session.countryAssignments.map((assignment) => assignment.countryCode);
    if (explicitCountryCode) assertCountryAccess(session, explicitCountryCode);
    return explicitCountryCode ? { countryCode: explicitCountryCode } : { countryCode: { in: assigned } };
  }
  return explicitCountryCode ? { countryCode: explicitCountryCode } : {};
}

function assertCountryAccessIfNeeded(session: AccountingSession, countryCode: string) {
  if (session.user.platformRole === "country_manager") assertCountryAccess(session, countryCode);
}

function buildDocumentNumber(type: AccountingDocumentType, order: { id: string; countryCode: string; paidAt: Date | null; createdAt: Date }) {
  const prefix = type === "invoice" ? "INV" : "RCT";
  const date = (order.paidAt ?? order.createdAt).toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${order.countryCode}-${date}-${order.id.slice(-8).toUpperCase()}`;
}

function sumDecimal(values: Array<Prisma.Decimal | number | string | null | undefined>) {
  return values.reduce<number>((total, value) => total + Number(value ?? 0), 0);
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
}

function csvCell(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
