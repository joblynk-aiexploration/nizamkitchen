import { Prisma, type MarketplacePolicy, type MarketplacePolicyResult } from "@prisma/client";
import type { PolicyEvaluation, PolicyEvaluationInput, PolicyRuleSet } from "@/server/policies/policy-types";

export function normalizePolicyRules(value: unknown): PolicyRuleSet {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as PolicyRuleSet;
}

export function evaluatePolicyRules(
  policy: MarketplacePolicy | null,
  input: PolicyEvaluationInput,
  overrideActive: boolean,
): PolicyEvaluation {
  if (!policy) {
    return {
      result: "allowed",
      allowed: true,
      policyId: null,
      policyName: null,
      reason: null,
      overrideActive: false,
      rules: {},
    };
  }

  const rules = normalizePolicyRules(policy.rulesJson);
  if (overrideActive) {
    return {
      result: "allowed",
      allowed: true,
      policyId: policy.id,
      policyName: policy.name,
      reason: "Active marketplace policy override.",
      overrideActive: true,
      rules,
    };
  }

  const metadata = input.metadata ?? {};
  const failedReason = firstFailedRule(rules, metadata);
  if (failedReason) {
    return {
      result: "denied",
      allowed: false,
      policyId: policy.id,
      policyName: policy.name,
      reason: rules.message ?? failedReason,
      overrideActive: false,
      rules,
    };
  }

  const result = (rules.effect ?? "allowed") as MarketplacePolicyResult;
  return {
    result,
    allowed: result === "allowed" || result === "warning",
    policyId: policy.id,
    policyName: policy.name,
    reason: rules.message ?? null,
    overrideActive: false,
    rules,
  };
}

export function rulesAsPrismaJson(rules: PolicyRuleSet): Prisma.InputJsonValue {
  return rules as Prisma.InputJsonObject;
}

function firstFailedRule(rules: PolicyRuleSet, metadata: Record<string, unknown>) {
  if (rules.requireSellerVerified && metadata.sellerVerified !== true) {
    return "Seller verification is required.";
  }
  if (rules.requirePayoutOnboarding && metadata.payoutReady !== true) {
    return "Payout onboarding is required.";
  }
  if (rules.requireAdminApproval && metadata.adminApproved !== true) {
    return "Platform admin approval is required.";
  }
  if (rules.requireActiveMenuItem && metadata.menuItemActive !== true) {
    return "An active menu item is required.";
  }
  if (rules.hideSuspendedSeller && metadata.sellerSuspended === true) {
    return "Suspended sellers are hidden by policy.";
  }
  if (rules.allowBeforeAcceptanceOnly && metadata.orderAccepted === true) {
    return "Cancellation is only allowed before seller acceptance.";
  }
  if (typeof rules.minimumOrderAmount === "number" && typeof metadata.orderAmount === "number" && metadata.orderAmount < rules.minimumOrderAmount) {
    return `Minimum order amount is ${rules.minimumOrderAmount}.`;
  }
  return null;
}
