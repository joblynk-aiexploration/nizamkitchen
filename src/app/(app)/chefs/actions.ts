"use server";

import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
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
      input: {
        requestType: formData.get("requestType") || "custom",
        title: formData.get("title"),
        description: formData.get("description"),
        recipeId: formData.get("recipeId"),
        mealPlanId: formData.get("mealPlanId"),
        requestedDate: formData.get("requestedDate"),
        requestedTimeWindow: formData.get("requestedTimeWindow"),
        guestCount: formData.get("guestCount"),
        householdSize: formData.get("householdSize"),
        serviceAddressLine1: formData.get("serviceAddressLine1"),
        serviceAddressLine2: formData.get("serviceAddressLine2"),
        city: formData.get("city"),
        region: formData.get("region"),
        postalCode: formData.get("postalCode"),
        phone: formData.get("phone"),
        preferredLanguage: formData.get("preferredLanguage"),
        genderPreference: formData.get("genderPreference") || "no_preference",
        budgetAmount: formData.get("budgetAmount"),
        budgetCurrency: formData.get("budgetCurrency") || session.activeOrganization.currencyCode,
        notes: formData.get("notes"),
      },
    });
    redirect(`/home-chef/requests/${request.id}?message=Chef request submitted.`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`/chefs/${slug}/request?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to request chef."))}`);
  }
}
