"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { env } from "@/lib/env";
import {
  cancelCustomerFoodOrder,
  createFoodOrder,
  createFoodOrderMessage,
} from "@/server/food-orders";
import { createStripeFoodOrderCheckout } from "@/server/payments/providers/stripe/stripe-adapter";
import { createPayPalFoodOrderCheckout } from "@/server/payments/providers/paypal/paypal-adapter";

export async function createFoodOrderAction(formData: FormData) {
  const session = await requireMembership();
  const order = await createFoodOrder({
    session,
    input: Object.fromEntries(formData),
  });
  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
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
