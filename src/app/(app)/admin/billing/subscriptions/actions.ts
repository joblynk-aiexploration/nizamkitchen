"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { changeSubscriptionPlan, updateSubscriptionStatus } from "@/server/billing/subscriptions";

const subscriptionsPath = "/admin/billing/subscriptions";

export async function cancelAdminSubscriptionAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const subscriptionId = String(formData.get("subscriptionId") ?? "");

  try {
    if (!subscriptionId) throw new Error("Choose a subscription to cancel.");
    await updateSubscriptionStatus(session, subscriptionId, "cancelled");
    revalidatePath(subscriptionsPath);
    redirect(`${subscriptionsPath}?message=${encodeURIComponent("Subscription cancelled in NizamKitchen.")}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${subscriptionsPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to cancel subscription."))}`);
  }
}

export async function changeAdminSubscriptionPlanAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const planId = String(formData.get("planId") ?? "");

  try {
    if (!subscriptionId) throw new Error("Choose a subscription to update.");
    if (!planId) throw new Error("Choose a replacement plan.");
    const subscription = await changeSubscriptionPlan(session, subscriptionId, planId);
    revalidatePath(subscriptionsPath);
    redirect(`${subscriptionsPath}?message=${encodeURIComponent(`Plan changed to ${subscription.plan.name}.`)}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${subscriptionsPath}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to change subscription plan."))}`);
  }
}
