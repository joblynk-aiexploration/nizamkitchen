"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/session";
import { createSellerPromotion } from "@/server/promotions";

export async function createCateringPromotionAction(formData: FormData) {
  const session = await requireMembership();
  await createSellerPromotion(session, formData);
  revalidatePath("/catering/promotions");
}
