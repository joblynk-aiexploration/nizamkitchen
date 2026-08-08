"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { updateAdminChefProfileStatus, updateAdminChefReviewStatus } from "@/server/chefs";

async function requireChefAdmin() {
  return requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
}

export async function updateAdminChefProfileAction(formData: FormData) {
  const chefProfileId = String(formData.get("chefProfileId"));
  try {
    const session = await requireChefAdmin();
    const profile = await updateAdminChefProfileStatus({
      session,
      chefProfileId,
      input: {
        status: formData.get("status") || undefined,
        verificationStatus: formData.get("verificationStatus") || undefined,
        isPublic: formData.get("isPublic") === "on",
        adminNotes: formData.get("adminNotes"),
      },
    });
    revalidatePath("/admin/chefs");
    revalidatePath(`/admin/chefs/${chefProfileId}`);
    revalidatePath("/chefs");
    revalidatePath(`/chefs/${profile.slug}`);
    redirect(`/admin/chefs/${chefProfileId}?message=Chef profile updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/chefs/${chefProfileId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update chef profile."))}`);
  }
}

export async function updateAdminChefReviewAction(formData: FormData) {
  const chefProfileId = String(formData.get("chefProfileId"));
  try {
    const session = await requireChefAdmin();
    await updateAdminChefReviewStatus({
      session,
      reviewId: String(formData.get("reviewId")),
      input: { status: formData.get("status") },
    });
    revalidatePath(`/admin/chefs/${chefProfileId}`);
    redirect(`/admin/chefs/${chefProfileId}?message=Review updated.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/chefs/${chefProfileId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update review."))}`);
  }
}
