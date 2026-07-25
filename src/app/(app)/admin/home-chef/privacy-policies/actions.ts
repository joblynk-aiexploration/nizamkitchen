"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { upsertHomeChefPrivacyPolicy } from "@/server/home-chef";

const path = "/admin/home-chef/privacy-policies";

export async function upsertHomeChefPrivacyPolicyAction(formData: FormData) {
  const policyId = String(formData.get("policyId") ?? "");
  try {
    const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
    await upsertHomeChefPrivacyPolicy({
      session,
      policyId: policyId || null,
      input: {
        countryCode: formData.get("countryCode"),
        region: formData.get("region"),
        city: formData.get("city"),
        requestType: formData.get("requestType"),
        revealExactAddressTrigger: formData.get("revealExactAddressTrigger"),
        revealCustomerNameTrigger: formData.get("revealCustomerNameTrigger"),
        allowPreAcceptanceMessaging: formData.get("allowPreAcceptanceMessaging") === "on",
        allowFirstNameBeforeAcceptance: formData.get("allowFirstNameBeforeAcceptance") === "on",
        allowPhoneProxyAfterLock: formData.get("allowPhoneProxyAfterLock") === "on",
        allowRealPhoneReveal: formData.get("allowRealPhoneReveal") === "on",
        allowEmailReveal: formData.get("allowEmailReveal") === "on",
        revokeAccessOnCancellation: formData.get("revokeAccessOnCancellation") === "on",
        revokeAccessAfterCompletionDays: formData.get("revokeAccessAfterCompletionDays"),
        emergencyContactWindowHours: formData.get("emergencyContactWindowHours"),
        status: formData.get("status"),
      },
    });

    revalidatePath(path);
    redirect(`${path}?message=Home Chef privacy policy saved.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${path}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save privacy policy."))}`);
  }
}
