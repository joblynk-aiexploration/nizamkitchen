import { PLAN_CATALOG, type PlanTier, type PlanLimitsJson } from "./plan-catalog";
import { getActiveSubscription } from "./subscriptions";
import { getUsageForPeriod, currentBillingPeriod } from "./usage";
import { getLimitOverrides, getLastMonthlyResetAt, type LimitOverrides } from "./limit-overrides";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EntitlementLimits = {
  // Household-focused: sourced from plan limitsJson in DB
  maxMealPlans: number;              // Infinity = unlimited
  maxGroceryListsPerMonth: number;
  maxHouseholdMembers: number;
  maxSavedRestaurants: number;
  maxChefRequestsPerMonth: number;
  // Seller-focused: sourced from plan limitsJson in DB (0 = not applicable)
  maxMenuItems: number;
  maxActiveServices: number;
  maxStaffMembers: number;
  maxLocations: number;
  maxOrdersPerMonth: number;
  maxBookingsPerMonth: number;
};

export type EntitlementFeatures = {
  // Household-focused: sourced from plan limitsJson in DB
  groceryExports: boolean;
  chefMarketplace: boolean;
  restaurantSearch: boolean;
  // Seller-focused: derived from plan tier at runtime
  analytics: boolean;
  advancedReporting: boolean;
  customerMessaging: boolean;
  priorityPlacement: boolean;
  staffAccounts: boolean;
  payoutAcceleration: boolean;
  multiLocation: boolean;
  promotions: boolean;
};

export type EntitlementUsage = {
  mealPlansThisMonth: number;
  groceryListsThisMonth: number;
  chefRequestsThisMonth: number;
};

export type PlanAudience =
  | "household"
  | "chef_staff"
  | "home_catering"
  | "restaurant"
  | "platform_internal"
  | "none";

export type Entitlement = {
  planSlug: string;
  planName: string;
  planTier: PlanTier;
  planAudience: PlanAudience;
  limits: EntitlementLimits;
  features: EntitlementFeatures;
};

// ── Tier feature matrix ────────────────────────────────────────────────────────

const TIER_SELLER_FEATURES: Record<
  PlanTier,
  Pick<EntitlementFeatures, "analytics" | "advancedReporting" | "customerMessaging" | "priorityPlacement" | "staffAccounts" | "payoutAcceleration" | "multiLocation" | "promotions">
> = {
  free:         { analytics: false, advancedReporting: false, customerMessaging: false, priorityPlacement: false, staffAccounts: false, payoutAcceleration: false, multiLocation: false, promotions: false },
  growth:       { analytics: true,  advancedReporting: false, customerMessaging: true,  priorityPlacement: true,  staffAccounts: false, payoutAcceleration: false, multiLocation: false, promotions: true  },
  professional: { analytics: true,  advancedReporting: true,  customerMessaging: true,  priorityPlacement: true,  staffAccounts: true,  payoutAcceleration: true,  multiLocation: true,  promotions: true  },
  enterprise:   { analytics: true,  advancedReporting: true,  customerMessaging: true,  priorityPlacement: true,  staffAccounts: true,  payoutAcceleration: true,  multiLocation: true,  promotions: true  },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

const FALLBACK_LIMITS_JSON: PlanLimitsJson = {
  maxMealPlans: 0,
  maxGroceryListsPerMonth: 0,
  maxHouseholdMembers: 1,
  maxSavedRestaurants: 0,
  maxChefRequestsPerMonth: 0,
  chefMarketplaceEnabled: false,
  groceryExportsEnabled: false,
  restaurantFallbackEnabled: false,
  maxMenuItems: 0,
  maxActiveServices: 0,
  maxLocations: 0,
  maxStaffMembers: 0,
  maxOrdersPerMonth: 0,
  maxBookingsPerMonth: 0,
};

// -1 (DB/catalog convention) → Infinity (public API convention)
function toPublicLimit(internal: number): number {
  return internal === -1 ? Infinity : internal;
}

function extractLimitsJson(raw: unknown): PlanLimitsJson {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return FALLBACK_LIMITS_JSON;
  const j = raw as Record<string, unknown>;
  return {
    maxMealPlans:             typeof j.maxMealPlans === "number"             ? j.maxMealPlans             : FALLBACK_LIMITS_JSON.maxMealPlans,
    maxGroceryListsPerMonth:  typeof j.maxGroceryListsPerMonth === "number"  ? j.maxGroceryListsPerMonth  : FALLBACK_LIMITS_JSON.maxGroceryListsPerMonth,
    maxHouseholdMembers:      typeof j.maxHouseholdMembers === "number"      ? j.maxHouseholdMembers      : FALLBACK_LIMITS_JSON.maxHouseholdMembers,
    maxSavedRestaurants:      typeof j.maxSavedRestaurants === "number"      ? j.maxSavedRestaurants      : FALLBACK_LIMITS_JSON.maxSavedRestaurants,
    maxChefRequestsPerMonth:  typeof j.maxChefRequestsPerMonth === "number"  ? j.maxChefRequestsPerMonth  : FALLBACK_LIMITS_JSON.maxChefRequestsPerMonth,
    chefMarketplaceEnabled:   typeof j.chefMarketplaceEnabled === "boolean"  ? j.chefMarketplaceEnabled   : FALLBACK_LIMITS_JSON.chefMarketplaceEnabled,
    groceryExportsEnabled:    typeof j.groceryExportsEnabled === "boolean"   ? j.groceryExportsEnabled    : FALLBACK_LIMITS_JSON.groceryExportsEnabled,
    restaurantFallbackEnabled: typeof j.restaurantFallbackEnabled === "boolean" ? j.restaurantFallbackEnabled : FALLBACK_LIMITS_JSON.restaurantFallbackEnabled,
    maxMenuItems:        typeof j.maxMenuItems === "number"        ? j.maxMenuItems        : FALLBACK_LIMITS_JSON.maxMenuItems,
    maxActiveServices:   typeof j.maxActiveServices === "number"   ? j.maxActiveServices   : FALLBACK_LIMITS_JSON.maxActiveServices,
    maxLocations:        typeof j.maxLocations === "number"        ? j.maxLocations        : FALLBACK_LIMITS_JSON.maxLocations,
    maxStaffMembers:     typeof j.maxStaffMembers === "number"     ? j.maxStaffMembers     : FALLBACK_LIMITS_JSON.maxStaffMembers,
    maxOrdersPerMonth:   typeof j.maxOrdersPerMonth === "number"   ? j.maxOrdersPerMonth   : FALLBACK_LIMITS_JSON.maxOrdersPerMonth,
    maxBookingsPerMonth: typeof j.maxBookingsPerMonth === "number" ? j.maxBookingsPerMonth : FALLBACK_LIMITS_JSON.maxBookingsPerMonth,
  };
}

function buildEntitlement(
  planSlug: string,
  planName: string,
  tier: PlanTier,
  audience: PlanAudience,
  limitsJson: PlanLimitsJson,
): Entitlement {
  return {
    planSlug,
    planName,
    planTier: tier,
    planAudience: audience,
    limits: {
      maxMealPlans:            toPublicLimit(limitsJson.maxMealPlans),
      maxGroceryListsPerMonth: toPublicLimit(limitsJson.maxGroceryListsPerMonth),
      maxHouseholdMembers:     toPublicLimit(limitsJson.maxHouseholdMembers),
      maxSavedRestaurants:     toPublicLimit(limitsJson.maxSavedRestaurants),
      maxChefRequestsPerMonth: toPublicLimit(limitsJson.maxChefRequestsPerMonth),
      maxMenuItems:            toPublicLimit(limitsJson.maxMenuItems),
      maxActiveServices:       toPublicLimit(limitsJson.maxActiveServices),
      maxLocations:            toPublicLimit(limitsJson.maxLocations),
      maxStaffMembers:         toPublicLimit(limitsJson.maxStaffMembers),
      maxOrdersPerMonth:       toPublicLimit(limitsJson.maxOrdersPerMonth),
      maxBookingsPerMonth:     toPublicLimit(limitsJson.maxBookingsPerMonth),
    },
    features: {
      groceryExports:   limitsJson.groceryExportsEnabled,
      chefMarketplace:  limitsJson.chefMarketplaceEnabled,
      restaurantSearch: limitsJson.restaurantFallbackEnabled,
      ...TIER_SELLER_FEATURES[tier],
    },
  };
}

const FALLBACK_ENTITLEMENT: Entitlement = {
  planSlug: "none",
  planName: "No Plan",
  planTier: "free",
  planAudience: "none",
  limits: {
    maxMealPlans: 0, maxGroceryListsPerMonth: 0, maxHouseholdMembers: 1,
    maxSavedRestaurants: 0, maxChefRequestsPerMonth: 0,
    maxMenuItems: 0, maxActiveServices: 0, maxStaffMembers: 0, maxLocations: 0,
    maxOrdersPerMonth: 0, maxBookingsPerMonth: 0,
  },
  features: {
    groceryExports: false, chefMarketplace: false, restaurantSearch: false,
    analytics: false, advancedReporting: false, customerMessaging: false,
    priorityPlacement: false, staffAccounts: false, payoutAcceleration: false,
    multiLocation: false, promotions: false,
  },
};

// ── Core async functions ───────────────────────────────────────────────────────

/**
 * Primary entitlement resolver. Fetches the org's active subscription and
 * returns a fully typed Entitlement. Call once per request; pass to synchronous
 * helpers below.
 *
 * Admin-set limit overrides are merged on top of the plan's limitsJson so every
 * downstream enforcement and usage path automatically respects them.
 */
export async function getEntitlement(organizationId: string): Promise<Entitlement> {
  const [subscription, overrides] = await Promise.all([
    getActiveSubscription(organizationId),
    getLimitOverrides(organizationId),
  ]);
  if (!subscription) return applyOverrides(FALLBACK_ENTITLEMENT, overrides);

  const slug = subscription.plan.slug;
  const catalogEntry = PLAN_CATALOG.find((p) => p.slug === slug);

  if (!catalogEntry) {
    // Plan exists in DB but is not in the active catalog (e.g. legacy archived slug).
    console.warn(`[entitlements] Unknown plan slug "${slug}" — returning locked-down fallback.`);
    return applyOverrides(
      { ...FALLBACK_ENTITLEMENT, planSlug: slug, planName: subscription.plan.name },
      overrides,
    );
  }

  const base = buildEntitlement(
    catalogEntry.slug,
    catalogEntry.name,
    catalogEntry.tier,
    catalogEntry.planAudience,
    extractLimitsJson(subscription.plan.limitsJson),
  );
  return applyOverrides(base, overrides);
}

/** Merges admin limit overrides on top of a base entitlement (overrides win per field). */
function applyOverrides(entitlement: Entitlement, overrides: LimitOverrides): Entitlement {
  if (Object.keys(overrides).length === 0) return entitlement;
  const merged = { ...entitlement.limits };
  for (const [key, value] of Object.entries(overrides) as [keyof EntitlementLimits, number][]) {
    if (key in merged && value !== undefined) {
      merged[key] = toPublicLimit(value);
    }
  }
  return { ...entitlement, limits: merged };
}

/** Returns plan identity and billing metadata without building the full entitlement. */
export async function getCurrentPlan(organizationId: string) {
  const subscription = await getActiveSubscription(organizationId);
  if (!subscription) return null;
  const catalogEntry = PLAN_CATALOG.find((p) => p.slug === subscription.plan.slug);
  return {
    slug: subscription.plan.slug,
    name: subscription.plan.name,
    tier: (catalogEntry?.tier ?? "free") as PlanTier,
    billingInterval: subscription.plan.billingInterval as "monthly" | "yearly" | "custom",
    priceAmount: Number(subscription.plan.priceAmount),
    status: subscription.status,
    subscriptionId: subscription.id,
  };
}

/**
 * Usage counts for tracked events in the current billing period.
 *
 * Respects admin monthly resets: if an admin has reset the org's monthly counters
 * this month, only events recorded after the reset timestamp are counted.
 * Historical data is preserved; the reset shifts the count window forward, not delete.
 *
 * Parallel with seller counters in enforcement.ts which use the same
 * getLastMonthlyResetAt / effectivePeriodStart pattern.
 */
export async function getCurrentUsage(organizationId: string): Promise<EntitlementUsage> {
  const { periodStart, periodEnd } = currentBillingPeriod();
  const lastReset = await getLastMonthlyResetAt(organizationId);
  // When a reset occurred after the calendar month start, count only events
  // recorded at or after the reset. When null or older than this month's start,
  // count the full calendar month (omitting the `since` filter preserves prior
  // behavior and avoids an unnecessary createdAt index hit).
  const since = lastReset && lastReset > periodStart ? lastReset : undefined;
  const [mealPlans, groceryLists, chefRequests] = await Promise.all([
    getUsageForPeriod(organizationId, "meal_plan_created", periodStart, periodEnd, since),
    getUsageForPeriod(organizationId, "grocery_list_created", periodStart, periodEnd, since),
    getUsageForPeriod(organizationId, "chef_request_submitted", periodStart, periodEnd, since),
  ]);
  return {
    mealPlansThisMonth: mealPlans,
    groceryListsThisMonth: groceryLists,
    chefRequestsThisMonth: chefRequests,
  };
}

// ── Synchronous helpers ────────────────────────────────────────────────────────

/** True when a limit is uncapped (Infinity or the legacy -1 DB sentinel). */
export function isUnlimited(limit: number): boolean {
  return limit === Infinity || limit === -1;
}

/** Remaining capacity for a counted limit. Returns Infinity when the limit is uncapped. */
export function remainingUsage(limit: number, current: number): number {
  if (isUnlimited(limit)) return Infinity;
  return Math.max(0, limit - current);
}

/** Feature flag gate — true when the entitlement grants the named feature. */
export function hasFeature(entitlement: Entitlement, feature: keyof EntitlementFeatures): boolean {
  return entitlement.features[feature];
}

// ── Permission helpers ─────────────────────────────────────────────────────────

/** Sellers can create menu items when the plan allows a non-zero menu item limit. */
export function canCreateMenuItem(entitlement: Entitlement): boolean {
  return isUnlimited(entitlement.limits.maxMenuItems) || entitlement.limits.maxMenuItems > 0;
}

/** Home chefs: can activate a service when the plan allows non-zero active services. */
export function canCreateService(entitlement: Entitlement): boolean {
  return isUnlimited(entitlement.limits.maxActiveServices) || entitlement.limits.maxActiveServices > 0;
}

/** Caterers: packages are menu items — same gate. */
export function canCreatePackage(entitlement: Entitlement): boolean {
  return canCreateMenuItem(entitlement);
}

/**
 * True when the plan supports more than one location (Professional+ only).
 * Free and Growth tiers are limited to a single location.
 */
export function canCreateLocation(entitlement: Entitlement): boolean {
  return isUnlimited(entitlement.limits.maxLocations) || entitlement.limits.maxLocations > 1;
}

/** True when the plan includes staff seat access (maxStaffMembers > 0, i.e. Professional+). */
export function canInviteStaff(entitlement: Entitlement): boolean {
  return isUnlimited(entitlement.limits.maxStaffMembers) || entitlement.limits.maxStaffMembers > 0;
}

/** True when a seller audience org's plan allows accepting inbound orders (maxOrdersPerMonth > 0). */
export function canAcceptOrder(entitlement: Entitlement): boolean {
  const SELLER_AUDIENCES: PlanAudience[] = ["chef_staff", "home_catering", "restaurant"];
  return (
    SELLER_AUDIENCES.includes(entitlement.planAudience) &&
    (isUnlimited(entitlement.limits.maxOrdersPerMonth) || entitlement.limits.maxOrdersPerMonth > 0)
  );
}

/** True for home chefs whose plan allows accepting marketplace booking requests. */
export function canAcceptBooking(entitlement: Entitlement): boolean {
  return (
    entitlement.planAudience === "chef_staff" &&
    (isUnlimited(entitlement.limits.maxBookingsPerMonth) || entitlement.limits.maxBookingsPerMonth > 0)
  );
}
