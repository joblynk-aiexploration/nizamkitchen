"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/session";
import { createFoodOrderMessage, updateSellerFoodOrderStatus } from "@/server/food-orders";
import { createSellerReviewReply } from "@/server/trust/review-service";

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

export async function createCateringReviewReplyAction(formData: FormData) {
  const session = await requireMembership();
  await createSellerReviewReply({ session, input: Object.fromEntries(formData) });
  revalidatePath("/catering/orders");
}
