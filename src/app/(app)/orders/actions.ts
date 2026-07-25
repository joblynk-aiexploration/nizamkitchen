"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { withAnalyticsEvent } from "@/lib/analytics/events";
import { env } from "@/lib/env";
import { normalizePhoneFromForm } from "@/lib/phone";
import {
  cancelCustomerFoodOrder,
  createFoodOrder,
  createFoodOrderMessage,
} from "@/server/food-orders";
import { createStripeFoodOrderCheckout } from "@/server/payments/providers/stripe/stripe-adapter";
import { createPayPalFoodOrderCheckout } from "@/server/payments/providers/paypal/paypal-adapter";
import { createMarketplaceReview, reportMarketplaceReview } from "@/server/trust/review-service";

export async function createFoodOrderAction(formData: FormData) {
  const session = await requireMembership();
  const order = await createFoodOrder({
    session,
    input: {
      ...Object.fromEntries(formData),
      customerPhone: normalizePhoneFromForm(formData, {
        countryCodeName: "customerPhoneCountryCode",
        nationalNumberName: "customerPhoneNationalNumber",
      }),
    },
  });
  revalidatePath("/orders");
  redirect(withAnalyticsEvent(`/orders/${order.id}?checkout=1#checkout`, "checkout_started"));
}

export async function createCustomerFoodOrderMessageAction(formData: FormData) {
  const session = await requireMembership();
  const orderId = String(formData.get("orderId") ?? "");
  await createFoodOrderMessage({
    session,
    orderId,
    audience: "customer",
    input: Object.fromEntries(formData),
  });
  revalidatePath(`/orders/${orderId}`);
}

export async function cancelCustomerFoodOrderAction(formData: FormData) {
  const session = await requireMembership();
  const orderId = String(formData.get("orderId") ?? "");
  await cancelCustomerFoodOrder({
    session,
    orderId,
    note: String(formData.get("note") ?? "") || null,
  });
  revalidatePath(`/orders/${orderId}`);
}

export async function createFoodOrderCheckoutAction(formData: FormData) {
  const session = await requireMembership();
  const orderId = String(formData.get("orderId") ?? "");
  const result = await createStripeFoodOrderCheckout({
    foodOrderId: orderId,
    userId: session.user.id,
    appUrl: env.APP_URL,
  });
  if (!result.checkoutUrl) throw new Error("Stripe checkout could not be created.");
  redirect(result.checkoutUrl);
}

export async function createPayPalFoodOrderCheckoutAction(formData: FormData) {
  const session = await requireMembership();
  const orderId = String(formData.get("orderId") ?? "");
  const result = await createPayPalFoodOrderCheckout({
    foodOrderId: orderId,
    userId: session.user.id,
    appUrl: env.APP_URL,
  });
  if (!result.checkoutUrl) throw new Error("PayPal checkout could not be created.");
  redirect(result.checkoutUrl);
}

export async function createFoodOrderReviewAction(formData: FormData) {
  const session = await requireMembership();
  const orderId = String(formData.get("foodOrderId") ?? "");
  await createMarketplaceReview({ session, input: Object.fromEntries(formData) });
  revalidatePath(`/orders/${orderId}`);
}

export async function reportFoodOrderReviewAction(formData: FormData) {
  const session = await requireMembership();
  await reportMarketplaceReview({ session, input: Object.fromEntries(formData) });
  revalidatePath("/orders");
}
