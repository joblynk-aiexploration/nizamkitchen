"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { moderateDeleteBusinessSocialLink } from "@/server/business-social-links";

export async function moderateDeleteBusinessSocialLinkAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
    await moderateDeleteBusinessSocialLink({
      session,
      linkId: String(formData.get("linkId") ?? ""),
    });
    revalidatePath("/admin/home-catering");
    revalidatePath("/admin/chefs");
    revalidatePath("/admin/restaurant-fallback");
    redirect("/admin?message=Social link removed.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to remove social link."))}`);
  }
}
