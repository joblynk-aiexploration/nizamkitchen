import { prisma } from "@/lib/prisma";
import { getEntitlement, isUnlimited } from "./entitlements";
import { getLastMonthlyResetAt } from "./limit-overrides";
import { currentBillingPeriod } from "./usage";
import { countAcceptedOffers } from "./booking-count";

// ── Error class ────────────────────────────────────────────────────────────────

export class EntitlementLimitError extends Error {
  readonly code: string;
  readonly current: number;
  readonly limit: number;
  readonly requiredPlan: string;
  readonly upgradeUrl: string;

  constructor(params: {
    code: string;
    message: string;
    current: number;
    limit: number;
    requiredPlan: string;
    upgradeUrl?: string;
  }) {
    super(params.message);
    this.name = "EntitlementLimitError";
    this.code = params.code;
    this.current = params.current;
    this.limit = params.limit;
    this.requiredPlan = params.requiredPlan;
    this.upgradeUrl = params.upgradeUrl ?? "/billing/upgrade";
  }

  toJSON() {
    return {
      error: "ENTITLEMENT_LIMIT_EXCEEDED" as const,
      code: this.code,
      message: this.message,
      current: this.current,
      limit: this.limit,
      requiredPlan: this.requiredPlan,
      upgradeUrl: this.upgradeUrl,
    };
  }
}

// ── Counting helpers ───────────────────────────────────────────────────────────

async function countActiveMenuItems(organizationId: string): Promise<number> {
  return prisma.menuItem.count({
    where: { organizationId, status: { not: "archived" } },
  });
}

async function countActiveServices(organizationId: string): Promise<number> {
  return prisma.chefService.count({
    where: { chefProfile: { organizationId }, isActive: true },
  });
}

/**
 * Returns the effective start of the current count window, respecting any admin
 * monthly reset. If the admin reset the usage after the calendar month start,
 * we count from the reset timestamp instead.
 */
async function effectivePeriodStart(organizationId: string): Promise<Date> {
  const { periodStart } = currentBillingPeriod();
  const lastReset = await getLastMonthlyResetAt(organizationId);
  if (lastReset && lastReset > periodStart) return lastReset;
  return periodStart;
}

async function countOrdersThisMonth(organizationId: string): Promise<number> {
  const since = await effectivePeriodStart(organizationId);
  return prisma.foodOrderStatusHistory.count({
    where: {
      newStatus: "accepted",
      createdAt: { gte: since },
      order: { sellerOrganizationId: organizationId },
    },
  });
}

async function countBookingsThisMonth(organizationId: string): Promise<number> {
  const since = await effectivePeriodStart(organizationId);
  return countAcceptedOffers(organizationId, since);
}

// ── Assertion functions ────────────────────────────────────────────────────────

/**
 * Throws EntitlementLimitError if the org has reached its menu item cap.
 * Applies to restaurant and catering orgs.
 */
export async function assertMenuItemLimit(organizationId: string): Promise<void> {
  const entitlement = await getEntitlement(organizationId);
  const limit = entitlement.limits.maxMenuItems;
  if (limit === 0) return; // not a menu-item audience (e.g. chef_staff)
  if (isUnlimited(limit)) return;

  const current = await countActiveMenuItems(organizationId);
  if (current >= limit) {
    throw new EntitlementLimitError({
      code: "MENU_ITEM_LIMIT_EXCEEDED",
      message: `Your plan allows ${limit} active menu item${limit === 1 ? "" : "s"}. You have ${current}. Upgrade to add more.`,
      current,
      limit,
      requiredPlan: entitlement.planTier === "free" ? "growth" : "professional",
    });
  }
}

/**
 * Throws EntitlementLimitError if the org has reached its active service cap.
 * Applies to chef_staff orgs.
 */
export async function assertServiceLimit(organizationId: string): Promise<void> {
  const entitlement = await getEntitlement(organizationId);
  const limit = entitlement.limits.maxActiveServices;
  if (limit === 0) return; // not a chef audience
  if (isUnlimited(limit)) return;

  const current = await countActiveServices(organizationId);
  if (current >= limit) {
    throw new EntitlementLimitError({
      code: "SERVICE_LIMIT_EXCEEDED",
      message: `Your plan allows ${limit} active service${limit === 1 ? "" : "s"}. You have ${current}. Upgrade to add more.`,
      current,
      limit,
      requiredPlan: entitlement.planTier === "free" ? "growth" : "professional",
    });
  }
}

/**
 * Throws EntitlementLimitError if the org has reached its monthly order acceptance cap.
 * Applies to restaurant and catering orgs.
 */
export async function assertOrderAcceptanceLimit(organizationId: string): Promise<void> {
  const entitlement = await getEntitlement(organizationId);
  const limit = entitlement.limits.maxOrdersPerMonth;
  if (limit === 0) return; // not an order-based audience
  if (isUnlimited(limit)) return;

  const current = await countOrdersThisMonth(organizationId);
  if (current >= limit) {
    throw new EntitlementLimitError({
      code: "ORDER_LIMIT_EXCEEDED",
      message: `Your plan allows ${limit} accepted order${limit === 1 ? "" : "s"} per month. You have accepted ${current} this month. Upgrade to accept more.`,
      current,
      limit,
      requiredPlan: entitlement.planTier === "free" ? "growth" : "professional",
    });
  }
}

/**
 * Throws EntitlementLimitError if the household has reached its member cap (maxHouseholdMembers).
 * Wire this into createHouseholdMemberAccount() before creating the membership record.
 */
export async function assertHouseholdMemberLimit(organizationId: string): Promise<void> {
  const entitlement = await getEntitlement(organizationId);
  const limit = entitlement.limits.maxHouseholdMembers;
  if (isUnlimited(limit)) return;

  const current = await prisma.membership.count({
    where: { organizationId, status: "active" },
  });
  if (current >= limit) {
    throw new EntitlementLimitError({
      code: "HOUSEHOLD_MEMBER_LIMIT_EXCEEDED",
      message: `Your plan allows ${limit} household member${limit === 1 ? "" : "s"}. You have ${current}. Upgrade your plan to add more members.`,
      current,
      limit,
      requiredPlan: entitlement.planTier === "free" ? "growth" : "professional",
      upgradeUrl: "/billing/plans",
    });
  }
}

/**
 * Throws EntitlementLimitError if the org has reached its location (pickup location) cap.
 * Applies to restaurant orgs. Call only on CREATE, not on UPDATE of an existing location.
 */
export async function assertLocationLimit(organizationId: string): Promise<void> {
  const entitlement = await getEntitlement(organizationId);
  const limit = entitlement.limits.maxLocations;
  if (limit === 0) return; // not a multi-location audience (household, chef)
  if (isUnlimited(limit)) return;

  const current = await prisma.fulfillmentPickupLocation.count({
    where: { organizationId, status: { not: "archived" } },
  });
  if (current >= limit) {
    throw new EntitlementLimitError({
      code: "LOCATION_LIMIT_EXCEEDED",
      message: `Your plan allows ${limit} pickup location${limit === 1 ? "" : "s"}. You have ${current}. Upgrade your plan to add more locations.`,
      current,
      limit,
      requiredPlan: entitlement.planTier === "free" ? "growth" : "professional",
      upgradeUrl: "/billing/plans",
    });
  }
}

/**
 * Throws EntitlementLimitError if the org has reached its staff member cap.
 * Applies to professional+ restaurant/catering orgs; most free plans have maxStaffMembers = 0.
 */
export async function assertStaffLimit(organizationId: string): Promise<void> {
  const entitlement = await getEntitlement(organizationId);
  const limit = entitlement.limits.maxStaffMembers;
  if (limit === 0) return; // staff not included on this plan
  if (isUnlimited(limit)) return;

  const current = await prisma.membership.count({
    where: { organizationId, status: "active" },
  });
  if (current >= limit) {
    throw new EntitlementLimitError({
      code: "STAFF_LIMIT_EXCEEDED",
      message: `You have reached your staff limit of ${limit} member${limit === 1 ? "" : "s"}. Upgrade your plan to add more.`,
      current,
      limit,
      requiredPlan: entitlement.planTier === "free" ? "growth" : "professional",
      upgradeUrl: "/billing/plans",
    });
  }
}

/**
 * Throws EntitlementLimitError if the org has reached its monthly booking acceptance cap.
 * Applies to chef_staff orgs.
 */
export async function assertBookingAcceptanceLimit(organizationId: string): Promise<void> {
  const entitlement = await getEntitlement(organizationId);
  const limit = entitlement.limits.maxBookingsPerMonth;
  if (limit === 0) return; // not a booking-based audience
  if (isUnlimited(limit)) return;

  const current = await countBookingsThisMonth(organizationId);
  if (current >= limit) {
    throw new EntitlementLimitError({
      code: "BOOKING_LIMIT_EXCEEDED",
      message: `Your plan allows ${limit} accepted booking${limit === 1 ? "" : "s"} per month. You have accepted ${current} this month. Upgrade to accept more.`,
      current,
      limit,
      requiredPlan: entitlement.planTier === "free" ? "growth" : "professional",
    });
  }
}
