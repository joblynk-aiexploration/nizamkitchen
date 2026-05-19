"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import {
  cancelCustomerFoodOrder,
  createFoodOrder,
  createFoodOrderMessage,
} from "@/server/food-orders";

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
