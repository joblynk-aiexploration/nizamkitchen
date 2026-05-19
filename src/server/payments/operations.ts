import { PaymentProvider, Prisma, type PlatformRole, type UserStatus } from "@prisma/client";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";

type PaymentAdminSession = {
  user: { id: string; email: string; status: UserStatus; platformRole: PlatformRole | null };
  countryAssignments: Array<{ countryCode: string }>;
};

const OPS_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"];
const MANAGE_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

export function assertPaymentOpsAccess(session: PaymentAdminSession) {
  assertPlatformRole(session.user.platformRole, OPS_ROLES);
}

export function assertPaymentManageAccess(session: PaymentAdminSession) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);
}

export async function getPaymentOperationsDashboard(session: PaymentAdminSession, filters: PaymentOpsFilters = {}) {
  assertPaymentOpsAccess(session);
  const where = paymentOrderWhere(session, filters);
  const [orders, refunds, disputes, payouts, failedEvents] = await Promise.all([
    prisma.paymentOrder.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.paymentRefund.findMany({ where: { paymentOrder: where }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.paymentDispute.findMany({ where: { paymentOrder: where }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.sellerPayout.findMany({ where: { organization: countryWhere(session, filters.countryCode) }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.paymentWebhookEvent.findMany({ where: { status: "failed" }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const grossVolume = sumDecimal(orders.filter((order) => order.status === "paid").map((order) => order.amount));
  const netPlatformFees = sumDecimal(orders.map((order) => order.platformFeeAmount));
  const sellerAmounts = sumDecimal(orders.map((order) => order.sellerAmount));
  const refundsTotal = sumDecimal(refunds.filter((refund) => refund.status === "succeeded" || refund.status === "processing").map((refund) => refund.amount));

  return {
    grossVolume,
    netPlatformFees,
    sellerAmounts,
    refundsTotal,
    failedPayments: orders.filter((order) => order.status === "failed").length,
    disputesCount: disputes.length,
    pendingPayouts: payouts.filter((payout) => payout.status === "pending" || payout.status === "in_transit").length,
    providerBreakdown: countBy(orders, (order) => order.provider),
    countryBreakdown: countBy(orders, (order) => order.countryCode),
    moduleBreakdown: countBy(orders, (order) => order.module),
    recentOrders: orders.slice(0, 10),
    recentRefunds: refunds.slice(0, 10),
    disputes,
    failedEvents,
  };
}

export async function getCommissionReport(session: PaymentAdminSession, filters: PaymentOpsFilters = {}) {
  assertPaymentOpsAccess(session);
  const orders = await prisma.paymentOrder.findMany({
    where: paymentOrderWhere(session, filters),
    include: {
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const refunds = await prisma.paymentRefund.findMany({
    where: { paymentOrder: paymentOrderWhere(session, filters), status: { in: ["processing", "succeeded"] } },
    include: { paymentOrder: { select: { sellerOrganizationId: true } } },
  });
  const bySeller = new Map<string, { sellerOrganizationId: string; grossSales: number; platformCommission: number; refunds: number; sellerNet: number; orders: number }>();
  for (const order of orders) {
    const sellerId = order.sellerOrganizationId ?? "platform";
    const current = bySeller.get(sellerId) ?? { sellerOrganizationId: sellerId, grossSales: 0, platformCommission: 0, refunds: 0, sellerNet: 0, orders: 0 };
    current.orders += 1;
    current.grossSales += Number(order.amount);
    current.platformCommission += Number(order.platformFeeAmount ?? 0);
    current.sellerNet += Number(order.sellerAmount ?? 0);
    bySeller.set(sellerId, current);
  }
  for (const refund of refunds) {
    const sellerId = refund.paymentOrder.sellerOrganizationId ?? "platform";
    const current = bySeller.get(sellerId) ?? { sellerOrganizationId: sellerId, grossSales: 0, platformCommission: 0, refunds: 0, sellerNet: 0, orders: 0 };
    current.refunds += Number(refund.amount);
    current.sellerNet = Math.max(0, current.sellerNet - Number(refund.amount));
    bySeller.set(sellerId, current);
  }
  return Array.from(bySeller.values());
}

export async function getSellerPaymentSummary(organizationId: string) {
  const [orders, payouts, payoutAccount] = await Promise.all([
    prisma.paymentOrder.findMany({ where: { sellerOrganizationId: organizationId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.sellerPayout.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.sellerPayoutAccount.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    payoutAccount,
    payouts,
    grossSales: sumDecimal(orders.filter((order) => order.status === "paid").map((order) => order.amount)),
    platformCommission: sumDecimal(orders.map((order) => order.platformFeeAmount)),
    sellerNet: sumDecimal(orders.map((order) => order.sellerAmount)),
    paidOrders: orders.filter((order) => order.status === "paid").length,
  };
}

export async function validateRefundAmount(paymentOrderId: string, amount: number) {
  const order = await prisma.paymentOrder.findUniqueOrThrow({
    where: { id: paymentOrderId },
    include: { refunds: true },
  });
  if (order.status === "refunded") throw new Error("This payment has already been fully refunded.");
  if (order.status !== "paid" && order.status !== "partially_refunded") throw new Error("Only paid payments can be refunded.");
  const refunded = sumDecimal(order.refunds.filter((refund) => refund.status !== "failed" && refund.status !== "cancelled").map((refund) => refund.amount));
  const remaining = Number(order.amount) - refunded;
  if (amount <= 0) throw new Error("Refund amount must be greater than zero.");
  if (amount > remaining) throw new Error("Refund amount cannot exceed the remaining paid amount.");
  return { order, refunded, remaining };
}

export async function markManualPaymentStatus(params: {
  session: PaymentAdminSession;
  paymentOrderId: string;
  status: "paid" | "failed";
  note?: string | null;
}) {
  assertPaymentManageAccess(params.session);
  const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: params.paymentOrderId } });
  if (order.provider !== PaymentProvider.manual && order.provider !== PaymentProvider.cash) {
    throw new Error("Manual reconciliation is available only for manual or cash payments.");
  }
  const updated = await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { status: params.status, paidAt: params.status === "paid" ? new Date() : null, failureMessage: params.status === "failed" ? params.note ?? "Manual payment failed." : null },
  });
  await prisma.paymentTransaction.create({
    data: {
      paymentOrderId: order.id,
      organizationId: order.organizationId,
      provider: order.provider,
      gatewayId: order.gatewayId,
      transactionType: "charge",
      status: params.status === "paid" ? "succeeded" : "failed",
      amount: order.amount,
      currencyCode: order.currencyCode,
      failureMessage: params.status === "failed" ? params.note ?? null : null,
    },
  });
  await syncModulePaymentStatus(order.id, params.status === "paid" ? "paid" : "failed");
  await createAuditEvent({
    actorUserId: params.session.user.id,
    organizationId: order.organizationId,
    countryCode: order.countryCode,
    action: params.status === "paid" ? "manual_payment.marked_paid" : "manual_payment.marked_failed",
    targetType: "payment_order",
    targetId: order.id,
    details: { note: params.note ?? null },
  });
  return updated;
}

export async function syncModulePaymentStatus(paymentOrderId: string, status: "paid" | "failed" | "refunded" | "partially_refunded") {
  const data = { paymentStatus: status, ...(status === "paid" ? { paidAt: new Date() } : {}) };
  await Promise.all([
    prisma.foodOrder.updateMany({ where: { paymentOrderId }, data }),
    prisma.homeChefRequest.updateMany({ where: { paymentOrderId }, data }),
  ]);
}

export async function exportPaymentsCsv(session: PaymentAdminSession, type: "transactions" | "refunds" | "disputes" | "payouts" | "commissions") {
  assertPaymentOpsAccess(session);
  if (type === "commissions") {
    return toCsv(["sellerOrganizationId", "orders", "grossSales", "platformCommission", "refunds", "sellerNet"], await getCommissionReport(session));
  }
  if (type === "refunds") {
    return toCsv(["id", "paymentOrderId", "provider", "status", "amount", "currencyCode", "createdAt"], await prisma.paymentRefund.findMany({ where: { paymentOrder: paymentOrderWhere(session) }, orderBy: { createdAt: "desc" }, take: 2000 }));
  }
  if (type === "disputes") {
    return toCsv(["id", "paymentOrderId", "provider", "status", "amount", "currencyCode", "reason", "createdAt"], await prisma.paymentDispute.findMany({ where: { paymentOrder: paymentOrderWhere(session) }, orderBy: { createdAt: "desc" }, take: 2000 }));
  }
  if (type === "payouts") {
    return toCsv(["id", "organizationId", "provider", "status", "amount", "currencyCode", "createdAt"], await prisma.sellerPayout.findMany({ where: { organization: countryWhere(session) }, orderBy: { createdAt: "desc" }, take: 2000 }));
  }
  return toCsv(["id", "paymentOrderId", "provider", "transactionType", "status", "amount", "currencyCode", "createdAt"], await prisma.paymentTransaction.findMany({ where: { paymentOrder: paymentOrderWhere(session) }, orderBy: { createdAt: "desc" }, take: 2000 }));
}

export type PaymentOpsFilters = {
  countryCode?: string;
  provider?: string;
  module?: string;
  status?: string;
  sellerOrganizationId?: string;
  customerOrganizationId?: string;
  from?: Date;
  to?: Date;
};

function paymentOrderWhere(session: PaymentAdminSession, filters: PaymentOpsFilters = {}): Prisma.PaymentOrderWhereInput {
  const country = countryWhere(session, filters.countryCode);
  return {
    ...country,
    ...(filters.provider ? { provider: filters.provider as never } : {}),
    ...(filters.module ? { module: filters.module as never } : {}),
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.sellerOrganizationId ? { sellerOrganizationId: filters.sellerOrganizationId } : {}),
    ...(filters.customerOrganizationId ? { customerOrganizationId: filters.customerOrganizationId } : {}),
    ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
  };
}

function countryWhere(session: PaymentAdminSession, explicitCountryCode?: string): { countryCode?: string | { in: string[] } } {
  if (session.user.platformRole === "country_manager") {
    const assigned = session.countryAssignments.map((assignment) => assignment.countryCode);
    if (explicitCountryCode) assertCountryAccess(session, explicitCountryCode);
    return explicitCountryCode ? { countryCode: explicitCountryCode } : { countryCode: { in: assigned } };
  }
  return explicitCountryCode ? { countryCode: explicitCountryCode } : {};
}

function sumDecimal(values: Array<Prisma.Decimal | number | string | null | undefined>) {
  return values.reduce<number>((total, value) => total + Number(value ?? 0), 0);
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
}

function csvCell(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
