"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/session";
import { createFoodOrderMessage, updateSellerFoodOrderStatus } from "@/server/food-orders";

export async function updateRestaurantFoodOrderStatusAction(formData: FormData) {
  const session = await requireMembership();
  const orderId = String(formData.get("orderId") ?? "");
  await updateSellerFoodOrderStatus({ session, orderId, input: Object.fromEntries(formData) });
  revalidatePath(`/restaurant/orders/${orderId}`);
  revalidatePath("/restaurant/orders");
}

export async function createRestaurantFoodOrderMessageAction(formData: FormData) {
  const session = await requireMembership();
  const orderId = String(formData.get("orderId") ?? "");
  await createFoodOrderMessage({ session, orderId, audience: "seller", input: Object.fromEntries(formData) });
  revalidatePath(`/restaurant/orders/${orderId}`);
}
