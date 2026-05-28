"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { createSellerPromotion } from "@/server/promotions";

export async function createRestaurantPromotionAction(formData: FormData) {
  const session = await requireMembership();
  try {
    await createSellerPromotion(session, formData);
    revalidatePath("/restaurant/promotions");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/restaurant/promotions?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create promotion. Please check the fields and try again."))}`);
  }

  redirect("/restaurant/promotions?message=Promotion created successfully.");
}
