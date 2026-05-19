"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/session";
import { createFoodOrderMessage, updateSellerFoodOrderStatus } from "@/server/food-orders";

export async function updateCateringFoodOrderStatusAction(formData: FormData) {
  const session = await requireMembership();
  const orderId = String(formData.get("orderId") ?? "");
  await updateSellerFoodOrderStatus({ session, orderId, input: Object.fromEntries(formData) });
  revalidatePath(`/catering/orders/${orderId}`);
  revalidatePath("/catering/orders");
}

export async function createCateringFoodOrderMessageAction(formData: FormData) {
  const session = await requireMembership();
  const orderId = String(formData.get("orderId") ?? "");
  await createFoodOrderMessage({ session, orderId, audience: "seller", input: Object.fromEntries(formData) });
  revalidatePath(`/catering/orders/${orderId}`);
}
