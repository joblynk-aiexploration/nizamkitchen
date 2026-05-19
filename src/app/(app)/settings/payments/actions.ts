"use server";

import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { createStripeConnectOnboarding } from "@/server/payments/providers/stripe/stripe-adapter";

export async function createStripeConnectOnboardingAction() {
  const session = await requireMembership();
  if (!["home_catering", "restaurant", "chef_business"].includes(session.activeOrganization.organizationType)) {
    redirect("/settings/payments?message=Seller payout setup is available only for business organizations.");
  }
  const result = await createStripeConnectOnboarding({
    organizationId: session.activeOrganization.id,
    countryCode: session.activeOrganization.countryCode,
    currencyCode: session.activeOrganization.currencyCode,
    appUrl: env.APP_URL,
  });
  redirect(result.onboardingUrl);
}
