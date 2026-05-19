"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { createStripeRefundForPaymentOrder } from "@/server/payments/providers/stripe/stripe-adapter";

export async function createStripeRefundAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const paymentOrderId = String(formData.get("paymentOrderId") ?? "");
  await createStripeRefundForPaymentOrder({
    paymentOrderId,
    amount: Number(formData.get("amount")),
    reason: String(formData.get("reason") ?? "") || undefined,
    requestedById: session.user.id,
  });
  revalidatePath(`/admin/payments/transactions/${paymentOrderId}`);
}
