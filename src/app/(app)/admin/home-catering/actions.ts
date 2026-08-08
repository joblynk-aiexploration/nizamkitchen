"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { updateAdminHomeCateringProfileStatus } from "@/server/home-catering";

async function requireCateringAdmin() {
  return requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
}

export async function updateAdminHomeCateringProfileAction(formData: FormData) {
  const profileId = String(formData.get("profileId"));
  try {
    const session = await requireCateringAdmin();
    const profile = await updateAdminHomeCateringProfileStatus({
      session,
      profileId,
      input: {
        status: formData.get("status") || undefined,
        verificationStatus: formData.get("verificationStatus") || undefined,
        isPublic: formData.get("isPublic") === "on",
        adminNotes: formData.get("adminNotes"),
      },
    });
    revalidatePath("/admin/home-catering");
    revalidatePath(`/admin/home-catering/${profileId}`);
    revalidatePath("/caterers");
    revalidatePath(`/caterers/${profile.slug}`);
    redirect(`/admin/home-catering/${profileId}?message=Home catering profile updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/home-catering/${profileId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update home catering profile."))}`);
  }
}
