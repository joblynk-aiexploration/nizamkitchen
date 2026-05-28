"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { createReferralCode } from "@/server/promotions";

export async function createReferralCodeAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  await createReferralCode(session, Object.fromEntries(formData));
  revalidatePath("/admin/referrals");
}
