"use server";

import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { homeChefRequestInputFromForm } from "@/lib/home-chef-request-form";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { canAccessChefMarketplace, requestSpecificChef } from "@/server/chefs";
import { isHouseholdRequestOrganization } from "@/server/home-chef";

async function requireHouseholdMarketplaceAccess() {
  const session = await requireMembership();
  const enabled = await canAccessChefMarketplace({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });
  if (!enabled) redirect("/chefs?message=Home chef marketplace is not enabled.");
  if (!isHouseholdRequestOrganization(session.activeOrganization.organizationType)) {
    redirect("/dashboard?message=Chef browsing is available only for household organizations.");
  }
  return session;
}

export async function requestSpecificChefAction(formData: FormData) {
  const slug = String(formData.get("chefSlug"));
  try {
    const session = await requireHouseholdMarketplaceAccess();
    const request = await requestSpecificChef({
      householdOrganizationId: session.activeOrganization.id,
      householdCountryCode: session.activeOrganization.countryCode,
      householdCurrencyCode: session.activeOrganization.currencyCode,
      actorUserId: session.user.id,
      chefSlug: slug,
      input: homeChefRequestInputFromForm(formData),
    });
    redirect(`/home-chef/requests/${request.id}?message=Chef request submitted.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chefs/${slug}/request?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to request chef."))}`);
  }
}
