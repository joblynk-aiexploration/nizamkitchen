import type { BillingPlan, BillingSubscription } from "@prisma/client";

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

const DEFAULT_LIMITS: PlanLimits = {
  maxMealPlans: 2,
  maxGroceryListsPerMonth: 5,
  maxHouseholdMembers: 1,
  maxSavedRestaurants: 5,
  maxChefRequestsPerMonth: 0,
  chefMarketplaceEnabled: false,
  groceryExportsEnabled: false,
  restaurantFallbackEnabled: false,
};

export const BUILT_IN_PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxMealPlans: 2,
    maxGroceryListsPerMonth: 5,
    maxHouseholdMembers: 1,
    maxSavedRestaurants: 5,
    maxChefRequestsPerMonth: 0,
    chefMarketplaceEnabled: false,
    groceryExportsEnabled: false,
    restaurantFallbackEnabled: false,
  },
  "family-plus": {
    maxMealPlans: 10,
    maxGroceryListsPerMonth: 20,
    maxHouseholdMembers: 6,
    maxSavedRestaurants: 30,
    maxChefRequestsPerMonth: 3,
    chefMarketplaceEnabled: true,
    groceryExportsEnabled: true,
    restaurantFallbackEnabled: true,
  },
  "premium-household": {
    maxMealPlans: -1,
    maxGroceryListsPerMonth: -1,
    maxHouseholdMembers: 10,
    maxSavedRestaurants: -1,
    maxChefRequestsPerMonth: 10,
    chefMarketplaceEnabled: true,
    groceryExportsEnabled: true,
    restaurantFallbackEnabled: true,
  },
  "chef-business": {
    maxMealPlans: 5,
    maxGroceryListsPerMonth: 10,
    maxHouseholdMembers: 5,
    maxSavedRestaurants: 10,
    maxChefRequestsPerMonth: -1,
    chefMarketplaceEnabled: true,
    groceryExportsEnabled: true,
    restaurantFallbackEnabled: false,
  },
  "restaurant-partner": {
    maxMealPlans: 2,
    maxGroceryListsPerMonth: 5,
    maxHouseholdMembers: 3,
    maxSavedRestaurants: -1,
    maxChefRequestsPerMonth: 0,
    chefMarketplaceEnabled: false,
    groceryExportsEnabled: false,
    restaurantFallbackEnabled: false,
  },
  enterprise: {
    maxMealPlans: -1,
    maxGroceryListsPerMonth: -1,
    maxHouseholdMembers: -1,
    maxSavedRestaurants: -1,
    maxChefRequestsPerMonth: -1,
    chefMarketplaceEnabled: true,
    groceryExportsEnabled: true,
    restaurantFallbackEnabled: true,
  },
};

export function getPlanLimits(plan: Pick<BillingPlan, "slug" | "limitsJson">): PlanLimits {
  const builtIn = BUILT_IN_PLAN_LIMITS[plan.slug];
  const overrides = (plan.limitsJson ?? {}) as Partial<PlanLimits>;
  const base = builtIn ?? DEFAULT_LIMITS;
  return { ...base, ...overrides };
}

export function isWithinLimit(current: number, limit: number): boolean {
  if (limit === -1) return true;
  return current < limit;
}

export function getUpgradeReasonForLimit(
  key: keyof PlanLimits,
  limits: PlanLimits,
): string | null {
  const labels: Partial<Record<keyof PlanLimits, string>> = {
    maxMealPlans: "more meal plans",
    maxGroceryListsPerMonth: "more grocery lists",
    maxHouseholdMembers: "more household members",
    maxSavedRestaurants: "more saved restaurants",
    maxChefRequestsPerMonth: "home chef requests",
    chefMarketplaceEnabled: "the chef marketplace",
    groceryExportsEnabled: "grocery list exports",
    restaurantFallbackEnabled: "restaurant search",
  };
  const label = labels[key];
  if (!label) return null;
  const value = limits[key];
  if (typeof value === "boolean" && !value) {
    return `Upgrade your plan to access ${label}.`;
  }
  if (typeof value === "number" && value !== -1) {
    return `Upgrade your plan to get more ${label} (current limit: ${value}).`;
  }
  return null;
}

export type SubscriptionWithPlan = BillingSubscription & { plan: BillingPlan };

export function getActiveSubscriptionLimits(
  subscription: SubscriptionWithPlan | null,
): PlanLimits {
  if (!subscription) return DEFAULT_LIMITS;
  return getPlanLimits(subscription.plan);
}
