"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { upsertHomeChefAcceptancePolicy } from "@/server/home-chef";

export async function upsertHomeChefAcceptancePolicyAction(formData: FormData) {
  const policyId = String(formData.get("policyId") ?? "");

  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
    await upsertHomeChefAcceptancePolicy({
      session,
      policyId: policyId || null,
      input: {
        countryCode: formData.get("countryCode"),
        region: formData.get("region"),
        city: formData.get("city"),
        requestType: formData.get("requestType"),
        leadTimeCategory: formData.get("leadTimeCategory"),
        acceptanceWindowMinutes: formData.get("acceptanceWindowMinutes"),
        autoCascadeEnabled: formData.get("autoCascadeEnabled") === "on",
        maxCascadeAttempts: formData.get("maxCascadeAttempts"),
        cascadeDelayMinutes: formData.get("cascadeDelayMinutes"),
        requireAdminReview: formData.get("requireAdminReview") === "on",
        requireVerifiedChef: formData.get("requireVerifiedChef") === "on",
        isActive: formData.get("isActive") === "on",
      },
    });

    revalidatePath("/admin/home-chef-acceptance-policies");
    redirect("/admin/home-chef-acceptance-policies?message=Acceptance policy saved.");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/admin/home-chef-acceptance-policies?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save acceptance policy."))}`);
  }
}
