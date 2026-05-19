"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { markManualPaymentStatus } from "@/server/payments/operations";
import { createPayPalRefundForPaymentOrder } from "@/server/payments/providers/paypal/paypal-adapter";
import { createStripeRefundForPaymentOrder } from "@/server/payments/providers/stripe/stripe-adapter";

export async function createProviderRefundAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const paymentOrderId = String(formData.get("paymentOrderId") ?? "");
  const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: paymentOrderId } });
  const input = { paymentOrderId, amount: Number(formData.get("amount")), reason: String(formData.get("reason") ?? "") || undefined, requestedById: session.user.id };
  if (order.provider === "paypal") await createPayPalRefundForPaymentOrder(input);
  else await createStripeRefundForPaymentOrder(input);
  revalidatePath(`/admin/payments/transactions/${paymentOrderId}`);
}

export async function markManualPaymentAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const paymentOrderId = String(formData.get("paymentOrderId") ?? "");
  const status = formData.get("status") === "failed" ? "failed" : "paid";
  await markManualPaymentStatus({
    session,
    paymentOrderId,
    status,
    note: String(formData.get("note") ?? "") || null,
  });
  revalidatePath(`/admin/payments/transactions/${paymentOrderId}`);
}
