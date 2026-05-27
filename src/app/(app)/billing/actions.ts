"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { createCustomerRefundRequest } from "@/server/payments/refund-requests";
import { createStripeSubscriptionCheckout } from "@/server/payments/providers/stripe/stripe-adapter";

export async function createSubscriptionCheckoutAction(formData: FormData) {
  const session = await requireMembership();
  const planId = String(formData.get("planId") ?? "");
  const promotionCode = String(formData.get("promotionCode") ?? "").trim();
  let checkoutUrl;
  try {
    const result = await createStripeSubscriptionCheckout({
      organizationId: session.activeOrganization.id,
      userId: session.user.id,
      planId,
      appUrl: env.APP_URL,
      promotionCode: promotionCode || null,
    });
    checkoutUrl = result.checkoutUrl;
    if (!checkoutUrl) throw new Error("Stripe subscription checkout could not be created.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/billing/plans?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to start subscription checkout. Please contact support or try again."))}`);
  }

  redirect(checkoutUrl);
}

export async function requestBillingRefundAction(formData: FormData) {
  const session = await requireMembership();
  const paymentOrderId = String(formData.get("paymentOrderId") ?? "");
  try {
    await createCustomerRefundRequest(session, {
      paymentOrderId,
      amount: Number(formData.get("amount")),
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath("/billing");
    redirect("/billing?message=Refund request submitted. Our billing team will review it and update you from the platform.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/billing/refunds/new?paymentOrderId=${encodeURIComponent(paymentOrderId)}&message=${encodeURIComponent(getActionErrorMessage(error, "Unable to submit refund request. Please check the payment and try again."))}`);
  }
}
