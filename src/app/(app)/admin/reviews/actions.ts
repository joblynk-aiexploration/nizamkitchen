"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { updateAdminReviewReport, updateAdminReviewStatus } from "@/server/trust/review-service";

export async function updateReviewModerationAction(formData: FormData) {
  const reviewId = String(formData.get("reviewId") ?? "");
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
    await updateAdminReviewStatus({ session, input: Object.fromEntries(formData) });
    revalidatePath("/admin/reviews");
    revalidatePath(`/admin/reviews/${reviewId}`);
    redirect(`/admin/reviews/${reviewId}?message=Review moderation saved.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/reviews/${reviewId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to moderate review."))}`);
  }
}

export async function updateReviewReportAction(formData: FormData) {
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
    await updateAdminReviewReport({ session, input: Object.fromEntries(formData) });
    revalidatePath("/admin/reviews/reports");
    redirect("/admin/reviews/reports?message=Report status saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/reviews/reports?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to update report."))}`);
  }
}
