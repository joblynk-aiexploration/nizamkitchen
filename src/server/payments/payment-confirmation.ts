import type { PaymentOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTemplateEmail } from "@/server/email/email-service";
import { createAdminNotification, createNotification } from "@/server/notifications/notification-service";

export async function notifyPaymentSucceeded(order: PaymentOrder) {
  await Promise.all([
    notifyCustomerPaymentSucceeded(order),
    notifyAdminsPaymentSucceeded(order),
  ]);
}

async function notifyCustomerPaymentSucceeded(order: PaymentOrder) {
  if (!order.customerUserId) return;

  const user = await prisma.user.findUnique({
    where: { id: order.customerUserId },
    select: { id: true, email: true, fullName: true },
  });
  if (!user?.email) return;

  const actionUrl = actionUrlForPaymentOrder(order.module, order.moduleEntityId);
  const type = order.module === "subscription" ? "subscription_payment_success" : "payment_success";
  const title = order.module === "subscription" ? "Subscription payment successful" : "Payment successful";
  const amount = Number(order.amount).toFixed(2);
  const body =
    order.module === "subscription"
      ? `Your NizamKitchen subscription payment of ${amount} ${order.currencyCode} was successful.`
      : `Your payment of ${amount} ${order.currencyCode} was successful.`;

  const existing = await prisma.notification.findFirst({
    where: { userId: user.id, type, actionUrl },
    select: { id: true },
  });
  if (!existing) {
    await createNotification({
      organizationId: order.organizationId,
      userId: user.id,
      countryCode: order.countryCode,
      type,
      title,
      body,
      actionUrl,
      priority: "normal",
    });
  }

  await sendTemplateEmail({
    to: user.email,
    recipientUserId: user.id,
    organizationId: order.organizationId,
    countryCode: order.countryCode,
    templateKey: "payment.success",
    variables: {
      userName: user.fullName,
      paymentAmount: amount,
      currencyCode: order.currencyCode,
      paymentStatus: "successful",
      dashboardUrl: actionUrl,
      primaryActionLabel: order.module === "subscription" ? "View billing" : "View details",
    },
    metadata: {
      paymentOrderId: order.id,
      module: order.module,
      moduleEntityId: order.moduleEntityId,
    },
    idempotencyKey: `payment.success:${order.id}`,
  });
}

async function notifyAdminsPaymentSucceeded(order: PaymentOrder) {
  const type = order.module === "subscription" ? "subscription_payment_received" : "payment_received";
  const actionUrl = `/admin/payments/transactions/${order.id}`;
  await createAdminNotification({
    organizationId: order.organizationId,
    countryCode: order.countryCode,
    type,
    title: order.module === "subscription" ? "Subscription payment received" : "Payment received",
    body: `${order.currencyCode} ${Number(order.amount).toFixed(2)} was confirmed through ${order.provider}.`,
    actionUrl,
    priority: "normal",
  });
}

function actionUrlForPaymentOrder(module: string, moduleEntityId: string) {
  if (module === "food_order") return `/orders/${moduleEntityId}`;
  if (module === "home_chef_request") return `/home-chef/requests/${moduleEntityId}`;
  if (module === "subscription") return "/billing";
  return "/billing";
}
