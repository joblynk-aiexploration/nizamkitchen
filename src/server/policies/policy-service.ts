import { assertCountryAccess, assertPlatformRole, type SessionLike } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { evaluatePolicyRules, rulesAsPrismaJson } from "@/server/policies/policy-evaluator";
import type { PolicyEvaluation, PolicyEvaluationInput, PolicyRuleSet } from "@/server/policies/policy-types";
import type {
  MarketplacePolicy,
  MarketplacePolicyModule,
  MarketplacePolicyStatus,
  OrganizationType,
  PlatformRole,
  Prisma,
  SellerType,
} from "@prisma/client";

type AdminSession = {
  user: { id: string; platformRole: PlatformRole | null };
  countryAssignments?: Array<{ countryCode: string }>;
};

const POLICY_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];
const POLICY_READ_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"];

export async function getEffectivePolicies(input: PolicyEvaluationInput) {
  if (!("marketplacePolicy" in prisma) || !prisma.marketplacePolicy) {
    return [];
  }

  const policies = await prisma.marketplacePolicy.findMany({
    where: {
      module: input.module,
      status: "active",
      OR: [
        {
          countryCode: input.countryCode ?? undefined,
          region: input.region ?? undefined,
          sellerType: input.sellerType ?? undefined,
          organizationType: input.organizationType ?? undefined,
        },
        {
          countryCode: input.countryCode ?? undefined,
          region: null,
          sellerType: input.sellerType ?? undefined,
          organizationType: input.organizationType ?? undefined,
        },
        {
          countryCode: input.countryCode ?? undefined,
          region: null,
          sellerType: null,
          organizationType: input.organizationType ?? undefined,
        },
        {
          countryCode: null,
          region: null,
          sellerType: input.sellerType ?? undefined,
          organizationType: null,
        },
        { countryCode: null, region: null, sellerType: null, organizationType: null },
      ],
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  return policies.sort((a, b) => policyScore(b, input) - policyScore(a, input));
}

export async function evaluatePolicy(input: PolicyEvaluationInput): Promise<PolicyEvaluation> {
  const policies = await getEffectivePolicies(input);
  const policy = policies[0] ?? null;
  const overrideActive = policy ? await hasActivePolicyOverride(policy.id, input) : false;
  const evaluation = evaluatePolicyRules(policy, input, overrideActive);
  await createPolicyEvaluationLog(input, evaluation);
  return evaluation;
}

export async function requirePolicyAllowed(input: PolicyEvaluationInput) {
  const evaluation = await evaluatePolicy(input);
  if (!evaluation.allowed) {
    throw new Error(evaluation.reason ?? "This action is blocked by platform policy.");
  }
  return evaluation;
}

export async function createPolicyEvaluationLog(input: PolicyEvaluationInput, evaluation: PolicyEvaluation) {
  if (!("marketplacePolicyEvaluationLog" in prisma) || !prisma.marketplacePolicyEvaluationLog) {
    return null;
  }

  const log = await prisma.marketplacePolicyEvaluationLog.create({
    data: {
      policyId: evaluation.policyId,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      module: input.module,
      action: String(input.action),
      result: evaluation.result,
      reason: evaluation.reason,
      metadataJson: (input.metadata ?? {}) as Prisma.InputJsonObject,
    },
  });

  if (evaluation.result === "denied") {
    await createAuditEvent({
      actorUserId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      countryCode: input.countryCode ?? null,
      action: "marketplace_policy.evaluated_denied",
      targetType: "marketplace_policy",
      targetId: evaluation.policyId,
      details: { module: input.module, action: input.action, reason: evaluation.reason },
    });
  }

  return log;
}

export async function listMarketplacePolicies(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, POLICY_READ_ROLES);
  return prisma.marketplacePolicy.findMany({
    include: {
      createdBy: { select: { fullName: true, email: true } },
      updatedBy: { select: { fullName: true, email: true } },
      _count: { select: { overrides: true, evaluationLogs: true } },
    },
    orderBy: [{ module: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getMarketplacePolicy(session: AdminSession, policyId: string) {
  assertPlatformRole(session.user.platformRole, POLICY_READ_ROLES);
  const policy = await prisma.marketplacePolicy.findUnique({
    where: { id: policyId },
    include: {
      createdBy: { select: { fullName: true, email: true } },
      updatedBy: { select: { fullName: true, email: true } },
      overrides: { include: { organization: true, user: true, createdBy: true, revokedBy: true }, orderBy: { createdAt: "desc" } },
      evaluationLogs: { orderBy: { createdAt: "desc" }, take: 25 },
    },
  });
  if (policy?.countryCode && session.user.platformRole === "country_manager") {
    assertCountryAccess(session as SessionLike, policy.countryCode);
  }
  return policy;
}

export async function saveMarketplacePolicy(
  session: AdminSession,
  input: {
    policyId?: string;
    name: string;
    description?: string | null;
    countryCode?: string | null;
    region?: string | null;
    sellerType?: SellerType | null;
    organizationType?: OrganizationType | null;
    module: MarketplacePolicyModule;
    status: MarketplacePolicyStatus;
    priority?: number;
    rules: PolicyRuleSet;
  },
) {
  assertPlatformRole(session.user.platformRole, POLICY_ADMIN_ROLES);
  const data = {
    name: input.name,
    description: input.description ?? null,
    countryCode: input.countryCode || null,
    region: input.region || null,
    sellerType: input.sellerType ?? null,
    organizationType: input.organizationType ?? null,
    module: input.module,
    status: input.status,
    priority: input.priority ?? 0,
    rulesJson: rulesAsPrismaJson(input.rules),
    updatedById: session.user.id,
  };
  const policy = input.policyId
    ? await prisma.marketplacePolicy.update({ where: { id: input.policyId }, data })
    : await prisma.marketplacePolicy.create({ data: { ...data, createdById: session.user.id } });
  await createAuditEvent({
    actorUserId: session.user.id,
    action: input.policyId ? policyActionForStatus(policy) : "marketplace_policy.created",
    targetType: "marketplace_policy",
    targetId: policy.id,
    countryCode: policy.countryCode,
    details: { module: policy.module, status: policy.status, priority: policy.priority },
  });
  return policy;
}

export async function createMarketplacePolicyOverride(
  session: AdminSession,
  input: {
    policyId: string;
    organizationId?: string | null;
    userId?: string | null;
    reason: string;
    expiresAt?: Date | null;
  },
) {
  assertPlatformRole(session.user.platformRole, POLICY_ADMIN_ROLES);
  const override = await prisma.marketplacePolicyOverride.create({
    data: {
      policyId: input.policyId,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      reason: input.reason,
      expiresAt: input.expiresAt ?? null,
      createdById: session.user.id,
    },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: override.organizationId,
    action: "marketplace_policy_override.created",
    targetType: "marketplace_policy_override",
    targetId: override.id,
    details: { policyId: override.policyId, reason: override.reason, expiresAt: override.expiresAt },
  });
  return override;
}

export async function revokeMarketplacePolicyOverride(session: AdminSession, overrideId: string) {
  assertPlatformRole(session.user.platformRole, POLICY_ADMIN_ROLES);
  const override = await prisma.marketplacePolicyOverride.update({
    where: { id: overrideId },
    data: { status: "revoked", revokedAt: new Date(), revokedById: session.user.id },
  });
  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: override.organizationId,
    action: "marketplace_policy_override.revoked",
    targetType: "marketplace_policy_override",
    targetId: override.id,
    details: { policyId: override.policyId },
  });
  return override;
}

export async function listMarketplacePolicyOverrides(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, POLICY_READ_ROLES);
  return prisma.marketplacePolicyOverride.findMany({
    include: { policy: true, organization: true, user: true, createdBy: true, revokedBy: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function listMarketplacePolicyEvaluationLogs(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, POLICY_READ_ROLES);
  return prisma.marketplacePolicyEvaluationLog.findMany({
    include: { policy: true, organization: true, user: true },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
}

async function hasActivePolicyOverride(policyId: string, input: PolicyEvaluationInput) {
  if (!("marketplacePolicyOverride" in prisma) || !prisma.marketplacePolicyOverride) {
    return false;
  }

  const now = new Date();
  const override = await prisma.marketplacePolicyOverride.findFirst({
    where: {
      policyId,
      status: "active",
      revokedAt: null,
      OR: [
        ...(input.organizationId ? [{ organizationId: input.organizationId }] : []),
        ...(input.userId ? [{ userId: input.userId }] : []),
      ],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    select: { id: true },
  });
  return Boolean(override);
}

function policyScore(policy: Pick<MarketplacePolicy, "countryCode" | "region" | "sellerType" | "organizationType" | "priority">, input: PolicyEvaluationInput) {
  let score = policy.priority * 10;
  if (policy.countryCode && policy.countryCode === input.countryCode) score += 8;
  if (policy.region && policy.region === input.region) score += 4;
  if (policy.sellerType && policy.sellerType === input.sellerType) score += 3;
  if (policy.organizationType && policy.organizationType === input.organizationType) score += 2;
  if (!policy.countryCode && !policy.region && !policy.sellerType && !policy.organizationType) score += 1;
  return score;
}

function policyActionForStatus(policy: MarketplacePolicy) {
  if (policy.status === "active") return "marketplace_policy.enabled";
  if (policy.status === "disabled") return "marketplace_policy.disabled";
  if (policy.status === "archived") return "marketplace_policy.archived";
  return "marketplace_policy.updated";
}
