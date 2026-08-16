import { prisma } from "@/lib/prisma";

export type StripeEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Checks whether an org is allowed to initiate a Stripe subscription checkout.
 *
 * Rules:
 * - Household orgs never reach Stripe (they have no paid plans).
 * - Plans with billingInterval = "custom" are enterprise/manual — contact-us only.
 * - Plans with priceAmount <= 0 are free — no checkout needed.
 * - Plans without a stripePriceId use dynamic price_data at checkout time (Model C hybrid).
 */
export async function checkStripeCheckoutEligibility(
  organizationId: string,
  planId: string,
): Promise<StripeEligibilityResult> {
  const [org, plan] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { organizationType: true },
    }),
    prisma.billingPlan.findUnique({
      where: { id: planId },
      select: { priceAmount: true, billingInterval: true, status: true },
    }),
  ]);

  if (!org) return { eligible: false, reason: "Organization not found." };
  if (!plan) return { eligible: false, reason: "Billing plan not found." };

  if (org.organizationType === "household") {
    return {
      eligible: false,
      reason: "Household accounts do not have paid subscriptions. Billing is not applicable.",
    };
  }

  if (plan.status !== "active") {
    return { eligible: false, reason: "This billing plan is not available for purchase." };
  }

  if (plan.billingInterval === "custom") {
    return {
      eligible: false,
      reason: "Enterprise plans require manual setup. Please contact us to get started.",
    };
  }

  if (Number(plan.priceAmount) <= 0) {
    return { eligible: false, reason: "This is a free plan — no checkout required." };
  }

  return { eligible: true };
}

/** Throws a user-facing error when the org/plan combination is not Stripe-eligible. */
export async function assertStripeCheckoutEligible(
  organizationId: string,
  planId: string,
): Promise<void> {
  const result = await checkStripeCheckoutEligibility(organizationId, planId);
  if (!result.eligible) {
    throw new Error(result.reason);
  }
}
