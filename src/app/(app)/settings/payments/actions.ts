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
  const result = await createPayoutOnboardingOrRedirect({
    organizationId: session.activeOrganization.id,
    countryCode: session.activeOrganization.countryCode,
    currencyCode: session.activeOrganization.currencyCode,
  });
  redirect(result.onboardingUrl);
}

async function createPayoutOnboardingOrRedirect(params: {
  organizationId: string;
  countryCode: string;
  currencyCode?: string | null;
}) {
  try {
    return await createStripeConnectOnboarding({
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      currencyCode: params.currencyCode ?? undefined,
      appUrl: env.APP_URL,
    });
  } catch (error) {
    console.warn("Stripe Connect onboarding could not start", getSafeStripeErrorLog(error));
    redirect(`/settings/payments?message=${encodeURIComponent(getPayoutSetupFailureMessage(error))}`);
  }
}

function getPayoutSetupFailureMessage(error: unknown) {
  const message = getErrorMessage(error);
  if (message.includes("signed up for Connect")) {
    return "Stripe Connect is not fully enabled for the configured Stripe account. Ask the Platform Owner to finish Connect activation in Stripe, then try payout setup again.";
  }
  if (message.includes("No active Stripe gateway") || message.includes("secret_key")) {
    return "Stripe payouts are not fully configured yet. Ask the Platform Owner to review Stripe gateway credentials in API Management.";
  }
  return "Stripe payout setup could not start right now. Please try again after the Platform Owner reviews the Stripe Connect configuration.";
}

function getSafeStripeErrorLog(error: unknown) {
  const detail = error as { message?: unknown; statusCode?: unknown; requestId?: unknown; type?: unknown; rawType?: unknown };
  return {
    message: typeof detail?.message === "string" ? detail.message : "Unknown Stripe Connect setup error",
    statusCode: typeof detail?.statusCode === "number" ? detail.statusCode : undefined,
    requestId: typeof detail?.requestId === "string" ? detail.requestId : undefined,
    type: typeof detail?.type === "string" ? detail.type : typeof detail?.rawType === "string" ? detail.rawType : undefined,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
}
