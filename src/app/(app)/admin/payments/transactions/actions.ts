"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { markManualPaymentStatus } from "@/server/payments/operations";
import { createPayPalRefundForPaymentOrder } from "@/server/payments/providers/paypal/paypal-adapter";
import { createStripeRefundForPaymentOrder } from "@/server/payments/providers/stripe/stripe-adapter";

export async function createProviderRefundAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const paymentOrderId = String(formData.get("paymentOrderId") ?? "");
  try {
    const order = await prisma.paymentOrder.findUniqueOrThrow({ where: { id: paymentOrderId } });
    const input = { paymentOrderId, amount: Number(formData.get("amount")), reason: String(formData.get("reason") ?? "") || undefined, requestedById: session.user.id };
    if (order.provider === "paypal") await createPayPalRefundForPaymentOrder(input);
    else if (order.provider === "stripe") await createStripeRefundForPaymentOrder(input);
    else throw new Error("Provider refunds are available only for Stripe or PayPal payments. Use manual reconciliation for cash or manual payments.");
    revalidatePath(`/admin/payments/transactions/${paymentOrderId}`);
    redirect(`/admin/payments/transactions/${paymentOrderId}?message=${encodeURIComponent("Refund request created successfully.")}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/payments/transactions/${paymentOrderId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create refund. Please check the payment details and try again."))}`);
  }
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
