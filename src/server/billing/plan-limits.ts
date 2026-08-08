// Admin UI display helper — reads a plan's raw limitsJson fields for the plan editor.
// Do NOT use for enforcement — enforcement uses entitlements.ts (getEntitlement).
import type { BillingPlan } from "@prisma/client";

export type PlanLimits = {
  maxMealPlans: number;
  maxGroceryListsPerMonth: number;
  maxHouseholdMembers: number;
  maxSavedRestaurants: number;
  maxChefRequestsPerMonth: number;
  chefMarketplaceEnabled: boolean;
  groceryExportsEnabled: boolean;
  restaurantFallbackEnabled: boolean;
};

// Zero-based defaults match FALLBACK_LIMITS_JSON in entitlements.ts.
// A plan without explicit limitsJson fields is locked down (0 = not included),
// not optimistic. The admin editor should always set values explicitly.
const DEFAULT_LIMITS: PlanLimits = {
  maxMealPlans: 0,
  maxGroceryListsPerMonth: 0,
  maxHouseholdMembers: 1,
  maxSavedRestaurants: 0,
  maxChefRequestsPerMonth: 0,
  chefMarketplaceEnabled: false,
  groceryExportsEnabled: false,
  restaurantFallbackEnabled: false,
};

export function getPlanLimits(plan: Pick<BillingPlan, "slug" | "limitsJson">): PlanLimits {
  const overrides = (plan.limitsJson ?? {}) as Partial<PlanLimits>;
  return { ...DEFAULT_LIMITS, ...overrides };
}
