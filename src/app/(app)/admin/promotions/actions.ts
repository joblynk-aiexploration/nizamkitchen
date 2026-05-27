"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { createAdminPromotion, updateAdminPromotion } from "@/server/promotions";

export async function createAdminPromotionAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  let promotion;

  try {
    promotion = await createAdminPromotion(session, Object.fromEntries(formData));
    revalidatePath("/admin/promotions");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/promotions/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create promotion. Please check the fields and try again."))}`);
  }

  redirect(`/admin/promotions/${promotion.id}?message=Promotion created successfully.`);
}

export async function updateAdminPromotionAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const promotionId = String(formData.get("promotionId") ?? "");
  if (!promotionId) {
    redirect(`/admin/promotions?message=${encodeURIComponent("Choose a promotion to update.")}`);
  }

  try {
    await updateAdminPromotion(session, promotionId, Object.fromEntries(formData));
    revalidatePath("/admin/promotions");
    revalidatePath(`/admin/promotions/${promotionId}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/promotions/${promotionId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save promotion. Please check the fields and try again."))}`);
  }

  redirect(`/admin/promotions/${promotionId}?message=Promotion saved successfully.`);
}
