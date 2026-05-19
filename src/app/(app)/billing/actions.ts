"use server";

import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { createStripeSubscriptionCheckout } from "@/server/payments/providers/stripe/stripe-adapter";

export async function createSubscriptionCheckoutAction(formData: FormData) {
  const session = await requireMembership();
  const planId = String(formData.get("planId") ?? "");
  const result = await createStripeSubscriptionCheckout({
    organizationId: session.activeOrganization.id,
    userId: session.user.id,
    planId,
    appUrl: env.APP_URL,
  });
  if (!result.checkoutUrl) throw new Error("Stripe subscription checkout could not be created.");
  redirect(result.checkoutUrl);
}
