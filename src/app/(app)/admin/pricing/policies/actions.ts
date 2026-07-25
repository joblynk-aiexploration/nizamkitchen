"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { getActionErrorMessage, rethrowIfRedirectError } from "@/lib/server-action-errors";
import { createFeePolicy, createFeeRule, updateFeePolicy } from "@/server/pricing/fee-policy-service";

const policiesPath = "/admin/pricing/policies";

export async function createFeePolicyAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  try {
    const policy = await createFeePolicy(session, formData);
    revalidatePath("/admin/pricing");
    revalidatePath(policiesPath);
    redirect(`${policiesPath}/${policy.id}?message=${encodeURIComponent("Fee policy created.")}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${policiesPath}/new?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to create fee policy."))}`);
  }
}

export async function updateFeePolicyAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const id = String(formData.get("policyId") ?? "");
  try {
    if (!id) throw new Error("Choose a fee policy to update.");
    await updateFeePolicy(session, id, formData);
    revalidatePath("/admin/pricing");
    revalidatePath(policiesPath);
    revalidatePath(`${policiesPath}/${id}`);
    redirect(`${policiesPath}/${id}?message=${encodeURIComponent("Fee policy saved.")}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${policiesPath}/${id}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to save fee policy."))}`);
  }
}

export async function createFeeRuleAction(formData: FormData) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const policyId = String(formData.get("feePolicyId") ?? "");
  try {
    await createFeeRule(session, formData);
    revalidatePath("/admin/pricing");
    revalidatePath(policiesPath);
    revalidatePath(`${policiesPath}/${policyId}`);
    redirect(`${policiesPath}/${policyId}?message=${encodeURIComponent("Fee rule added.")}`);
  } catch (error) {
    rethrowIfRedirectError(error);
    redirect(`${policiesPath}/${policyId}?message=${encodeURIComponent(getActionErrorMessage(error, "Unable to add fee rule."))}`);
  }
}
