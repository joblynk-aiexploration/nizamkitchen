"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { grantPlatformCredit } from "@/server/promotions";

export async function grantPlatformCreditAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  await grantPlatformCredit(session, Object.fromEntries(formData));
  revalidatePath("/admin/credits");
}
