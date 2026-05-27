import { publicPageMetadata } from "@/lib/seo/public-page-metadata";
import { listActiveBillingPlans } from "@/server/billing/plans";
import { PricingCarousel, type PricingPlan } from "./pricing-carousel";

export const generateMetadata = () => publicPageMetadata("/pricing");

const trustNotes = [
  "Only active plans approved by the Platform Owner are visible for public signup.",
  "Draft and archived plans remain private in the admin console until activated.",
  "Seller profiles require admin review before public marketplace visibility.",
  "Grocery lists are planning estimates and should be checked before shopping.",
];

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

function inferAccountType(slug: string) {
  if (slug.includes("chef")) return "chef";
  if (slug.includes("catering")) return "catering";
  if (slug.includes("restaurant")) return "restaurant";
  return "household";
}

function normalizeFeatures(featuresJson: unknown) {
  if (!Array.isArray(featuresJson)) return [];
  return featuresJson
    .map((feature) => (typeof feature === "string" ? feature.trim() : ""))
    .filter(Boolean);
}

async function getPricingPlans(): Promise<PricingPlan[]> {
  const activePlans = await listActiveBillingPlans();
  return activePlans.map((plan, index) => {
    const priceAmount = Number(plan.priceAmount);
    const isCustom = plan.billingInterval === "custom";
    const isFree = priceAmount <= 0;
    const features = normalizeFeatures(plan.featuresJson);

    return {
      name: plan.name,
      price: isCustom ? "Custom" : formatPlanPrice(plan.priceAmount, plan.currencyCode),
      period: isFree ? "forever" : formatBillingInterval(plan.billingInterval),
      description: plan.description ?? "A NizamKitchen plan managed by the Platform Owner.",
      cta: isCustom ? "Contact us" : isFree ? "Sign up free" : "Sign up",
      href: isCustom
        ? "/contact?topic=enterprise"
        : `/register?type=${inferAccountType(plan.slug)}&plan=${encodeURIComponent(plan.slug)}`,
      highlight: index === 1 || (!isFree && index === 0),
      badge: isCustom ? "Custom" : isFree ? "Free" : "Active",
      features: features.length ? features : ["Managed by NizamKitchen", "Role-based access", "Secure billing records"],
    };
  });
}

export default async function PricingPage() {
  const plans = await getPricingPlans();

  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Pricing
          </p>
          <h1 className="mt-3 font-serif text-4xl text-[var(--color-ink)] sm:text-5xl">
            Simple plans for every kitchen.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--color-muted)]">
            Start free and upgrade as your kitchen grows. Chef, catering, restaurant, and enterprise
            plans are available with manual onboarding.
          </p>
        </div>

        {plans.length ? (
          <PricingCarousel plans={plans} />
        ) : (
          <div className="rounded-[2rem] border border-[var(--color-border)] bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              Plans are being finalized
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[var(--color-ink)]">
              Public pricing is not available yet.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
              The Platform Owner has not activated any purchasable plans. Please check back soon
              or contact us for onboarding help.
            </p>
          </div>
        )}

        <div className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="font-serif text-2xl text-[var(--color-ink)]">Good to know</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {trustNotes.map((note) => (
              <p key={note} className="rounded-2xl bg-white px-4 py-3 text-sm text-[var(--color-muted)]">
                {note}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
