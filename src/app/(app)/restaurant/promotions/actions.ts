"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/session";
import { createSellerPromotion } from "@/server/promotions";

export async function createRestaurantPromotionAction(formData: FormData) {
  const session = await requireMembership();
  await createSellerPromotion(session, formData);
  revalidatePath("/restaurant/promotions");
}
