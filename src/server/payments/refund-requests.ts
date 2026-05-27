import { Prisma, type PaymentOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";

type MemberPaymentSession = {
  user: { id: string };
  activeOrganization: { id: string; countryCode: string; currencyCode: string };
};

const REFUNDABLE_STATUSES: PaymentOrderStatus[] = ["paid", "partially_refunded"];
const OPEN_REFUND_STATUSES = ["requested", "processing"] as const;

export function refundRemainingAmount(order: { amount: unknown; refunds: Array<{ status: string; amount: unknown }> }) {
  const refunded = order.refunds
    .filter((refund) => refund.status !== "failed" && refund.status !== "cancelled")
    .reduce((total, refund) => total + Number(refund.amount ?? 0), 0);

  return Math.max(0, Number(order.amount ?? 0) - refunded);
}

function memberPaymentOrderWhere(session: MemberPaymentSession) {
  return {
    OR: [
      { organizationId: session.activeOrganization.id },
      { customerOrganizationId: session.activeOrganization.id },
      { customerUserId: session.user.id },
    ],
  };
}

export async function listRefundablePaymentOrders(session: MemberPaymentSession) {
  const orders = await prisma.paymentOrder.findMany({
    where: {
      ...memberPaymentOrderWhere(session),
      status: { in: REFUNDABLE_STATUSES },
    },
    include: {
      refunds: true,
      accountingDocuments: { where: { documentType: "invoice" }, select: { id: true, documentNumber: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 50,
  });

  return orders
    .map((order) => ({ ...order, remainingRefundAmount: refundRemainingAmount(order) }))
    .filter((order) => order.remainingRefundAmount > 0);
}

export async function createCustomerRefundRequest(
  session: MemberPaymentSession,
  input: { paymentOrderId: string; amount: number; reason: string },
) {
  const reason = input.reason.trim();
  if (!input.paymentOrderId) throw new Error("Please select the payment you want reviewed for a refund.");
  if (!reason) throw new Error("Please tell us why you are requesting a refund.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Refund amount must be greater than zero.");

  const order = await prisma.paymentOrder.findFirst({
    where: {
      id: input.paymentOrderId,
      ...memberPaymentOrderWhere(session),
      status: { in: REFUNDABLE_STATUSES },
    },
    include: { refunds: true },
  });
  if (!order) throw new Error("We could not find a paid payment that can be refunded for this account.");

  const existingOpenRefund = order.refunds.find((refund) => OPEN_REFUND_STATUSES.includes(refund.status as never));
  if (existingOpenRefund) {
    throw new Error("A refund review is already open for this payment. Please wait for the billing team to complete that review.");
  }

  const remaining = refundRemainingAmount(order);
  if (input.amount > remaining) {
    throw new Error(`Refund amount cannot exceed the remaining refundable amount of ${order.currencyCode} ${remaining.toFixed(2)}.`);
  }

  const refund = await prisma.paymentRefund.create({
    data: {
      paymentOrderId: order.id,
      organizationId: order.organizationId,
      provider: order.provider,
      gatewayId: order.gatewayId,
      status: "requested",
      amount: new Prisma.Decimal(input.amount),
      currencyCode: order.currencyCode,
      reason,
      requestedById: session.user.id,
    },
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: session.activeOrganization.id,
    countryCode: order.countryCode,
    action: "payment_refund.customer_requested",
    targetType: "payment_refund",
    targetId: refund.id,
    details: {
      paymentOrderId: order.id,
      amount: input.amount,
      currencyCode: order.currencyCode,
    },
  });

  return refund;
}
