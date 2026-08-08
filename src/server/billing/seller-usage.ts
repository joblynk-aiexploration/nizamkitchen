import { prisma } from "@/lib/prisma";
import { PLAN_CATALOG } from "./plan-catalog";
import { getEntitlement, isUnlimited, type Entitlement } from "./entitlements";
import { getLastMonthlyResetAt } from "./limit-overrides";
import { currentBillingPeriod } from "./usage";
import { countAcceptedOffers } from "./booking-count";

export type UsageMetric = {
  key: string;
  label: string;
  current: number;
  limit: number; // Infinity = unlimited
};

export type UpgradePlanOption = {
  slug: string;
  name: string;
  tier: string;
  billingInterval: "monthly" | "yearly" | "custom";
  priceAmount: number;
  featuresJson: string[];
};

export type SellerUsageData = {
  entitlement: Entitlement;
  metrics: UsageMetric[];
  upgradePlans: UpgradePlanOption[];
};

const TIER_ORDER = ["free", "growth", "professional", "enterprise"] as const;
type KnownTier = (typeof TIER_ORDER)[number];

function nextTier(current: string): KnownTier | null {
  const idx = TIER_ORDER.indexOf(current as KnownTier);
  if (idx === -1 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

export async function getSellerUsage(organizationId: string): Promise<SellerUsageData> {
  const [entitlement, lastReset] = await Promise.all([
    getEntitlement(organizationId),
    getLastMonthlyResetAt(organizationId),
  ]);
  const { limits, planAudience, planTier } = entitlement;

  // Respect admin monthly resets by counting from max(calendarMonthStart, lastReset)
  const { periodStart: calendarStart } = currentBillingPeriod();
  const periodStart = lastReset && lastReset > calendarStart ? lastReset : calendarStart;

  const jobs: Array<Promise<UsageMetric>> = [];

  if (planAudience === "restaurant" || planAudience === "home_catering") {
    const itemLabel = planAudience === "home_catering" ? "Packages" : "Menu Items";

    jobs.push(
      prisma.menuItem
        .count({ where: { organizationId, status: { not: "archived" } } })
        .then((current) => ({ key: "menuItems", label: itemLabel, current, limit: limits.maxMenuItems })),
    );

    if (limits.maxOrdersPerMonth > 0) {
      jobs.push(
        prisma.foodOrderStatusHistory
          .count({
            where: {
              newStatus: "accepted",
              createdAt: { gte: periodStart },
              order: { sellerOrganizationId: organizationId },
            },
          })
          .then((current) => ({ key: "orders", label: "Orders", current, limit: limits.maxOrdersPerMonth })),
      );
    }
  }

  if (planAudience === "chef_staff") {
    jobs.push(
      prisma.chefService
        .count({ where: { chefProfile: { organizationId }, isActive: true } })
        .then((current) => ({ key: "services", label: "Services", current, limit: limits.maxActiveServices })),
    );

    if (limits.maxBookingsPerMonth > 0) {
      jobs.push(
        countAcceptedOffers(organizationId, periodStart).then((current) => ({
          key: "bookings",
          label: "Bookings",
          current,
          limit: limits.maxBookingsPerMonth,
        })),
      );
    }
  }

  if (limits.maxStaffMembers > 0) {
    jobs.push(
      prisma.membership
        .count({ where: { organizationId, status: "active" } })
        .then((current) => ({ key: "staff", label: "Staff", current, limit: limits.maxStaffMembers })),
    );
  }

  const metrics = await Promise.all(jobs);

  const upgradeTier = nextTier(planTier);
  const upgradePlans: UpgradePlanOption[] = upgradeTier
    ? PLAN_CATALOG.filter(
        (p) => p.planAudience === planAudience && p.tier === upgradeTier && p.status === "active",
      ).map((p) => ({
        slug: p.slug,
        name: p.name,
        tier: p.tier,
        billingInterval: p.billingInterval,
        priceAmount: p.priceAmount,
        featuresJson: p.featuresJson,
      }))
    : [];

  return { entitlement, metrics, upgradePlans };
}

export function isMetricAtLimit(metric: UsageMetric): boolean {
  return !isUnlimited(metric.limit) && metric.limit > 0 && metric.current >= metric.limit;
}

export function isMetricUnlimited(metric: UsageMetric): boolean {
  return isUnlimited(metric.limit) || metric.limit === 0;
}
