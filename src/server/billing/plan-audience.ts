import type { OrganizationType, PlatformRole } from "@prisma/client";

// Defined locally because @prisma/client re-exports via .prisma/client which
// doesn't resolve correctly under moduleResolution: "bundler" for new enums.
export type BillingPlanAudience =
  | "household"
  | "chef_staff"
  | "home_catering"
  | "restaurant"
  | "platform_internal";

export const BILLING_PLAN_AUDIENCES: readonly BillingPlanAudience[] = [
  "household",
  "chef_staff",
  "home_catering",
  "restaurant",
  "platform_internal",
] as const;

export const BILLING_PLAN_AUDIENCE_LABELS: Record<BillingPlanAudience, string> = {
  household: "Household",
  chef_staff: "Home Chef",
  home_catering: "Home Catering",
  restaurant: "Restaurant",
  platform_internal: "Internal",
};

export const PUBLIC_BILLING_PLAN_AUDIENCES = [
  "household",
  "chef_staff",
  "home_catering",
  "restaurant",
] as const;

export function billingPlanAudienceLabel(audience: BillingPlanAudience) {
  return BILLING_PLAN_AUDIENCE_LABELS[audience] ?? "Household";
}

export function billingPlanAudienceForOrganizationType(organizationType?: OrganizationType | string | null) {
  if (organizationType === "chef_business") return "chef_staff";
  if (organizationType === "home_catering") return "home_catering";
  if (organizationType === "restaurant") return "restaurant";
  if (organizationType === "internal_admin") return "platform_internal";
  if (organizationType === "household") return "household";
  return null;
}

export function isPlatformBillingUser(platformRole?: PlatformRole | string | null) {
  return platformRole === "platform_owner" || platformRole === "platform_admin";
}

export function assertPlanAudienceAllowed(params: {
  planAudience: BillingPlanAudience | string;
  organizationType?: OrganizationType | string | null;
  platformRole?: PlatformRole | string | null;
}) {
  if (isPlatformBillingUser(params.platformRole)) return;
  if (params.planAudience === "platform_internal") {
    throw new Error("This plan is not available for your account type.");
  }

  const organizationAudience = billingPlanAudienceForOrganizationType(params.organizationType);
  if (!organizationAudience || organizationAudience !== params.planAudience) {
    throw new Error("This plan is not available for your account type.");
  }
}
