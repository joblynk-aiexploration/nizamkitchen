"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import {
  grantEnterprisePlan,
  overrideOrgLimits,
  clearOrgLimitOverrides,
  resetMonthlyUsage,
} from "@/server/billing/admin-ops";
import { type LimitOverrideKey, ALL_LIMIT_KEYS } from "@/server/billing/limit-overrides";

export async function grantEnterprisePlanAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await grantEnterprisePlan(session, organizationId);
    revalidatePath(`/admin/billing/orgs/${organizationId}`);
    revalidatePath("/admin/billing/subscriptions");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      `/admin/billing/orgs/${organizationId}?message=${encodeURIComponent(
        getActionErrorMessage(error, "Failed to grant enterprise plan."),
      )}`,
    );
  }
  redirect(`/admin/billing/orgs/${organizationId}?message=Enterprise+plan+granted+successfully.`);
}

export async function setLimitOverrideAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    const overrides: Partial<Record<LimitOverrideKey, number>> = {};
    for (const key of ALL_LIMIT_KEYS) {
      const raw = formData.get(key);
      if (raw !== null && raw !== "") {
        const val = Number(raw);
        if (!Number.isNaN(val)) overrides[key] = val;
      }
    }
    await overrideOrgLimits(session, organizationId, overrides);
    revalidatePath(`/admin/billing/orgs/${organizationId}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      `/admin/billing/orgs/${organizationId}?message=${encodeURIComponent(
        getActionErrorMessage(error, "Failed to set limit overrides."),
      )}`,
    );
  }
  redirect(`/admin/billing/orgs/${organizationId}?message=Limit+overrides+saved.`);
}

export async function clearLimitOverridesAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await clearOrgLimitOverrides(session, organizationId);
    revalidatePath(`/admin/billing/orgs/${organizationId}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      `/admin/billing/orgs/${organizationId}?message=${encodeURIComponent(
        getActionErrorMessage(error, "Failed to clear limit overrides."),
      )}`,
    );
  }
  redirect(`/admin/billing/orgs/${organizationId}?message=Limit+overrides+cleared.`);
}

export async function resetMonthlyUsageAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const organizationId = String(formData.get("organizationId") ?? "");
  try {
    await resetMonthlyUsage(session, organizationId);
    revalidatePath(`/admin/billing/orgs/${organizationId}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(
      `/admin/billing/orgs/${organizationId}?message=${encodeURIComponent(
        getActionErrorMessage(error, "Failed to reset monthly usage."),
      )}`,
    );
  }
  redirect(`/admin/billing/orgs/${organizationId}?message=Monthly+usage+reset+successfully.`);
}
