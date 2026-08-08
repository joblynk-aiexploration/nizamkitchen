/**
 * Admin-only billing operations: grant enterprise, override limits, reset monthly usage.
 * All functions require platform_owner or platform_admin role via assertPlatformRole.
 */

import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { PLAN_CATALOG } from "./plan-catalog";
import { assignSubscription } from "./subscriptions";
import {
  setLimitOverride,
  clearAllLimitOverrides,
  recordMonthlyReset,
  type LimitOverrideKey,
  type LimitOverrides,
} from "./limit-overrides";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

const ENTERPRISE_SLUG_BY_AUDIENCE: Record<string, string> = {
  chef_staff: "home-chef-enterprise",
  home_catering: "catering-enterprise",
  restaurant: "restaurant-enterprise",
  platform_internal: "enterprise-internal",
};

const AUDIENCE_BY_ORG_TYPE: Record<string, string> = {
  chef_business: "chef_staff",
  home_catering: "home_catering",
  restaurant: "restaurant",
  internal_admin: "platform_internal",
};

/**
 * Grants an enterprise plan to any non-household org.
 * Finds the appropriate enterprise plan slug from the catalog, looks it up in the DB,
 * and calls assignSubscription with status=active, provider=manual.
 */
export async function grantEnterprisePlan(
  session: Session,
  organizationId: string,
): Promise<void> {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { organizationType: true, name: true },
  });

  if (org.organizationType === "household") {
    throw new Error("Household organizations do not receive enterprise plans.");
  }

  const audience = AUDIENCE_BY_ORG_TYPE[org.organizationType];
  if (!audience) {
    throw new Error(`No enterprise plan available for organization type: ${org.organizationType}`);
  }

  const enterpriseSlug = ENTERPRISE_SLUG_BY_AUDIENCE[audience];
  const catalogEntry = PLAN_CATALOG.find((p) => p.slug === enterpriseSlug);
  if (!catalogEntry) {
    throw new Error(`Enterprise plan "${enterpriseSlug}" not found in catalog.`);
  }

  const plan = await prisma.billingPlan.findUnique({ where: { slug: enterpriseSlug } });
  if (!plan) {
    throw new Error(
      `Enterprise plan "${enterpriseSlug}" is not in the database. Run the billing seed first.`,
    );
  }

  await assignSubscription(session, organizationId, plan.id, {
    status: "active",
    provider: "manual",
  });
}

/**
 * Sets one or more per-org limit overrides. Pass -1 to grant unlimited for a field.
 * Overrides stack on top of the plan's limitsJson — they win on a per-field basis.
 */
export async function overrideOrgLimits(
  session: Session,
  organizationId: string,
  overrides: LimitOverrides,
): Promise<void> {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);

  const entries = Object.entries(overrides) as [LimitOverrideKey, number][];
  if (entries.length === 0) return;

  for (const [key, value] of entries) {
    await setLimitOverride(organizationId, key, value);
  }

  await createAuditEvent({
    actorUserId: session.user.id,
    action: "billing.limit_override_set",
    targetType: "organization",
    targetId: organizationId,
    organizationId,
    details: { overrides },
  });
}

/**
 * Clears ALL admin limit overrides for an org, reverting it to plan defaults.
 */
export async function clearOrgLimitOverrides(
  session: Session,
  organizationId: string,
): Promise<void> {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);

  await clearAllLimitOverrides(organizationId);

  await createAuditEvent({
    actorUserId: session.user.id,
    action: "billing.limit_overrides_cleared",
    targetType: "organization",
    targetId: organizationId,
    organizationId,
    details: {},
  });
}

/**
 * Resets the monthly usage counters for an org without deleting historical data.
 * After a reset, enforcement counting starts from the reset timestamp instead of
 * the calendar month start — effectively zeroing out the current month's usage.
 */
export async function resetMonthlyUsage(
  session: Session,
  organizationId: string,
): Promise<void> {
  assertPlatformRole(session.user.platformRole, ["platform_owner", "platform_admin"]);

  const resetAt = await recordMonthlyReset(organizationId);

  await createAuditEvent({
    actorUserId: session.user.id,
    action: "billing.monthly_usage_reset",
    targetType: "organization",
    targetId: organizationId,
    organizationId,
    details: { resetAt: resetAt.toISOString() },
  });
}

/** Reads the billing subscription history (audit trail) for an org. */
export async function getSubscriptionHistory(
  session: Session,
  organizationId: string,
) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);

  return prisma.auditLog.findMany({
    where: {
      organizationId,
      action: { startsWith: "billing_subscription." },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actorUser: { select: { id: true, fullName: true, email: true } } },
  });
}
