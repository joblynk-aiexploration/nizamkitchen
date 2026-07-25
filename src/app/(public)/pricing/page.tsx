import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo/public-page-metadata";
import { listActiveBillingPlans } from "@/server/billing/plans";
import { billingPlanAudienceLabel, PUBLIC_BILLING_PLAN_AUDIENCES } from "@/server/billing/plan-audience";
import { PricingScroller } from "./pricing-scroller";

export const generateMetadata = () => publicPageMetadata("/pricing");

export type PricingPlan = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  href: string;
  highlight: boolean;
  isPopular: boolean;
  badge: string;
  accountType: string;
  planAudience: "household" | "chef_staff" | "home_catering" | "restaurant";
  audienceLabel: string;
  keyLimits: string[];
  features: string[];
};

function formatPlanPrice(amount: unknown, currencyCode: string) {
  const price = Number(amount);
  if (price <= 0) return "Free";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  }).format(price);
}

function formatBillingInterval(interval: string) {
  if (interval === "yearly") return "per year";
  if (interval === "custom") return "custom terms";
  return "per month";
}

function normalizeFeatures(featuresJson: unknown) {
  if (!Array.isArray(featuresJson)) return [];
  return featuresJson
    .map((feature) => (typeof feature === "string" ? feature.trim() : ""))
    .filter(Boolean);
}

function normalizeKeyLimits(limitsJson: unknown) {
  if (!limitsJson || typeof limitsJson !== "object" || Array.isArray(limitsJson)) return [];
  const limits = limitsJson as Record<string, unknown>;
  const rows = [
    ["Meal plans", limits.maxMealPlans],
    ["Grocery lists/mo", limits.maxGroceryListsPerMonth],
    ["Household members", limits.maxHouseholdMembers],
    ["Chef requests/mo", limits.maxChefRequestsPerMonth],
  ];

  return rows
    .filter(([, value]) => typeof value === "number")
    .map(([label, value]) => `${label}: ${value === -1 ? "Unlimited" : value}`);
}

function registerTypeForAudience(audience: PricingPlan["planAudience"]) {
  if (audience === "chef_staff") return "chef";
  if (audience === "home_catering") return "catering";
  return audience;
}

function ctaForAudience(audience: PricingPlan["planAudience"], fallback: string) {
  if (audience === "chef_staff") return "Join as Home Chef";
  if (audience === "home_catering") return "Start Catering Plan";
  if (audience === "restaurant") return "Start Restaurant Plan";
  return fallback;
}

async function getPricingPlans(): Promise<PricingPlan[]> {
  const activePlans = await listActiveBillingPlans();
  return activePlans
    .filter((plan) => PUBLIC_BILLING_PLAN_AUDIENCES.includes(plan.planAudience as PricingPlan["planAudience"]))
    .map((plan) => {
    const priceAmount = Number(plan.priceAmount);
    const isCustom = plan.billingInterval === "custom";
    const isFree = priceAmount <= 0;
    const features = normalizeFeatures(plan.featuresJson);
    const planAudience = plan.planAudience as PricingPlan["planAudience"];
    const fallbackCta = isCustom ? "Contact us" : isFree ? "Sign up free" : "Choose plan";

    return {
      name: plan.name,
      price: isCustom ? "Custom" : formatPlanPrice(plan.priceAmount, plan.currencyCode),
      period: isCustom ? "custom terms" : isFree ? "forever" : formatBillingInterval(plan.billingInterval),
      description: plan.description ?? "A NizamKitchen plan managed by the Platform Owner.",
      cta: ctaForAudience(planAudience, fallbackCta),
      href: isCustom
        ? "/contact?topic=enterprise"
        : `/register?type=${registerTypeForAudience(planAudience)}&plan=${encodeURIComponent(plan.slug)}`,
      highlight: plan.isPopular,
      isPopular: plan.isPopular,
      badge: isCustom ? "Custom" : isFree ? "Free" : "Active",
      accountType: billingPlanAudienceLabel(plan.planAudience),
      planAudience,
      audienceLabel: billingPlanAudienceLabel(plan.planAudience),
      keyLimits: normalizeKeyLimits(plan.limitsJson),
      features: features.length ? features : ["Managed by NizamKitchen", "Role-based access", "Secure billing records"],
    };
  });
}

export default async function PricingPage() {
  const plans = await getPricingPlans();

  return (
    <main className="bg-[#f6f8fb]">
      <section className="border-b border-slate-200 bg-white px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Pricing</p>
            <h1 className="mt-4 max-w-4xl font-serif text-4xl leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Enterprise-grade plans for households and food operators.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Start with the right kitchen workflow, then expand into meal planning, grocery execution,
              home chef requests, catering operations, restaurant orders, billing, and compliance.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={plans[0]?.href ?? "/contact?topic=pricing"}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                View active plans
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact?topic=enterprise"
                className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-teal-600 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Talk to onboarding
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Active public plans</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-950">Choose the operating model that fits today.</h2>
            </div>
          </div>

          {plans.length ? (
            <PricingScroller plans={plans} />
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Plans are being finalized</p>
              <h2 className="mt-3 font-serif text-3xl text-slate-950">Public pricing is not available yet.</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                The Platform Owner has not activated any purchasable plans. Please check back soon
                or contact us for onboarding help.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
