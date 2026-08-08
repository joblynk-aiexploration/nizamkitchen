/**
 * Admin-set per-org limit overrides stored in BillingUsageRecord.
 *
 * Overrides use usageType "admin_limit_override:{limitKey}" with:
 *   quantity = the new hard limit (negative means unlimited = -1 convention)
 *   periodStart = epoch (2000-01-01)
 *   periodEnd   = far future (2099-12-31)
 *
 * The latest record for each limit key wins. Creating a new record for the same
 * key effectively supersedes the previous one (findFirst with orderBy createdAt desc).
 *
 * Monthly reset records use usageType "admin_monthly_reset":
 *   quantity    = 0 (sentinel)
 *   periodStart = start of the month being reset
 *   periodEnd   = end of the month being reset
 *
 * Enforcement counting queries respect the reset by using max(monthStart, lastResetAt)
 * as the lower-bound cutoff for monthly counts.
 */

import { prisma } from "@/lib/prisma";

const OVERRIDE_PREFIX = "admin_limit_override:";
const RESET_TYPE = "admin_monthly_reset";

const OVERRIDE_PERIOD_START = new Date("2000-01-01T00:00:00.000Z");
const OVERRIDE_PERIOD_END = new Date("2099-12-31T23:59:59.999Z");

export type LimitOverrideKey =
  | "maxMenuItems"
  | "maxActiveServices"
  | "maxStaffMembers"
  | "maxLocations"
  | "maxOrdersPerMonth"
  | "maxBookingsPerMonth"
  | "maxMealPlans"
  | "maxGroceryListsPerMonth"
  | "maxHouseholdMembers"
  | "maxSavedRestaurants"
  | "maxChefRequestsPerMonth";

export const ALL_LIMIT_KEYS: LimitOverrideKey[] = [
  "maxMenuItems",
  "maxActiveServices",
  "maxStaffMembers",
  "maxLocations",
  "maxOrdersPerMonth",
  "maxBookingsPerMonth",
  "maxMealPlans",
  "maxGroceryListsPerMonth",
  "maxHouseholdMembers",
  "maxSavedRestaurants",
  "maxChefRequestsPerMonth",
];

export type LimitOverrides = Partial<Record<LimitOverrideKey, number>>;

/** Returns all active admin limit overrides for an org. Empty object = no overrides. */
export async function getLimitOverrides(organizationId: string): Promise<LimitOverrides> {
  const records = await prisma.billingUsageRecord.findMany({
    where: {
      organizationId,
      usageType: { startsWith: OVERRIDE_PREFIX },
      periodEnd: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  const overrides: LimitOverrides = {};
  const seen = new Set<string>();

  for (const record of records) {
    const key = record.usageType.slice(OVERRIDE_PREFIX.length) as LimitOverrideKey;
    if (!seen.has(key) && ALL_LIMIT_KEYS.includes(key)) {
      seen.add(key);
      // quantity stores the new limit value; negative means unlimited (-1 convention)
      overrides[key] = record.quantity < 0 ? -1 : record.quantity;
    }
  }

  return overrides;
}

/** Sets a single admin limit override for an org. Pass -1 to grant unlimited. */
export async function setLimitOverride(
  organizationId: string,
  limitKey: LimitOverrideKey,
  newLimit: number,
): Promise<void> {
  await prisma.billingUsageRecord.create({
    data: {
      organizationId,
      usageType: `${OVERRIDE_PREFIX}${limitKey}`,
      quantity: newLimit,
      periodStart: OVERRIDE_PERIOD_START,
      periodEnd: OVERRIDE_PERIOD_END,
    },
  });
}

/** Clears all admin limit overrides for an org by expiring them. */
export async function clearAllLimitOverrides(organizationId: string): Promise<void> {
  await prisma.billingUsageRecord.deleteMany({
    where: {
      organizationId,
      usageType: { startsWith: OVERRIDE_PREFIX },
    },
  });
}

/** Clears a single admin limit override for an org. */
export async function clearLimitOverride(
  organizationId: string,
  limitKey: LimitOverrideKey,
): Promise<void> {
  await prisma.billingUsageRecord.deleteMany({
    where: {
      organizationId,
      usageType: `${OVERRIDE_PREFIX}${limitKey}`,
    },
  });
}

/**
 * Records an admin-initiated monthly usage reset for an org.
 * Enforcement counting will respect this by only counting events after the reset.
 */
export async function recordMonthlyReset(organizationId: string): Promise<Date> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  await prisma.billingUsageRecord.create({
    data: {
      organizationId,
      usageType: RESET_TYPE,
      quantity: 0,
      periodStart: monthStart,
      periodEnd: monthEnd,
    },
  });

  return now;
}

/**
 * Returns the timestamp of the last admin monthly reset for an org in the current period,
 * or null if no reset has occurred this month.
 */
export async function getLastMonthlyResetAt(organizationId: string): Promise<Date | null> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const record = await prisma.billingUsageRecord.findFirst({
    where: {
      organizationId,
      usageType: RESET_TYPE,
      periodStart: { gte: monthStart },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return record?.createdAt ?? null;
}
