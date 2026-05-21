"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { createAdminPromotion } from "@/server/promotions";

export async function createAdminPromotionAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const promotion = await createAdminPromotion(session, Object.fromEntries(formData));
  revalidatePath("/admin/promotions");
  redirect(`/admin/promotions/${promotion.id}`);
}
