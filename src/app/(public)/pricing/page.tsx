import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Check, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo/public-page-metadata";
import { listActiveBillingPlans } from "@/server/billing/plans";
import { billingPlanAudienceLabel, PUBLIC_BILLING_PLAN_AUDIENCES } from "@/server/billing/plan-audience";
import { PricingPlans } from "./pricing-plans";

export const generateMetadata = () => publicPageMetadata("/pricing");

export type PricingPlan = {
  name: string;
  price: string;
  period: string;
  billingInterval: "monthly" | "yearly" | "custom";
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
  monthlyEquivalent?: string;
  annualSavingsLabel?: string;
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
  const rows: [string, unknown][] = [
    ["Meal plans",            limits.maxMealPlans],
    ["Grocery lists/mo",      limits.maxGroceryListsPerMonth],
    ["Household members",     limits.maxHouseholdMembers],
    ["Chef requests/mo",      limits.maxChefRequestsPerMonth],
  ];

  return rows
    .filter(([, value]) => typeof value === "number")
    .map(([label, value]) => `${label}: ${value === -1 ? "Unlimited" : value}`);
}

function registerTypeForAudience(audience: PricingPlan["planAudience"]) {
  if (audience === "chef_staff")    return "chef";
  if (audience === "home_catering") return "catering";
  return audience;
}

function ctaForAudience(audience: PricingPlan["planAudience"], fallback: string) {
  if (audience === "chef_staff")    return "Join as Home Chef";
  if (audience === "home_catering") return "Start Catering Plan";
  if (audience === "restaurant")    return "Start Restaurant Plan";
  return fallback;
}

type RawBillingPlan = Awaited<ReturnType<typeof listActiveBillingPlans>>[number] & {
  planAudience: PricingPlan["planAudience"];
  isPopular: boolean;
};

async function getPricingPlans(): Promise<PricingPlan[]> {
  const activePlans = (await listActiveBillingPlans()) as RawBillingPlan[];
  return activePlans
    .filter((plan) => PUBLIC_BILLING_PLAN_AUDIENCES.includes(plan.planAudience))
    .sort((a, b) => {
      if (a.billingInterval === "custom" && b.billingInterval !== "custom") return 1;
      if (b.billingInterval === "custom" && a.billingInterval !== "custom") return -1;
      return Number(a.priceAmount) - Number(b.priceAmount);
    })
    .map((plan) => {
      const priceAmount = Number(plan.priceAmount);
      const isCustom   = plan.billingInterval === "custom";
      const isFree     = priceAmount <= 0;
      const features   = normalizeFeatures(plan.featuresJson);
      const planAudience  = plan.planAudience;
      const fallbackCta = isCustom ? "Contact us" : isFree ? "Sign up free" : "Choose plan";

      const isYearly = plan.billingInterval === "yearly";
      let monthlyEquivalent: string | undefined;
      let annualSavingsLabel: string | undefined;
      if (isYearly && priceAmount > 0) {
        const moEquiv = priceAmount / 12;
        monthlyEquivalent = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: plan.currencyCode,
          maximumFractionDigits: 0,
        }).format(moEquiv) + "/mo";
        annualSavingsLabel = "Save 20%";
      }

      return {
        name:            plan.name,
        price:           isCustom ? "Custom" : formatPlanPrice(plan.priceAmount, plan.currencyCode),
        period:          isCustom ? "custom terms" : isFree ? "forever" : formatBillingInterval(plan.billingInterval),
        billingInterval: plan.billingInterval as PricingPlan["billingInterval"],
        description:     plan.description ?? "A NizamKitchen plan managed by the Platform Owner.",
        cta:             isCustom ? "Contact Sales" : ctaForAudience(planAudience, fallbackCta),
        href:            isCustom
          ? "/contact?topic=enterprise"
          : `/register?type=${registerTypeForAudience(planAudience)}&plan=${encodeURIComponent(plan.slug)}`,
        highlight:     plan.isPopular,
        isPopular:     plan.isPopular,
        badge:         isCustom ? "Custom" : isFree ? "Free" : "Active",
        accountType:   billingPlanAudienceLabel(plan.planAudience),
        planAudience,
        audienceLabel: billingPlanAudienceLabel(plan.planAudience),
        keyLimits:     normalizeKeyLimits(plan.limitsJson),
        features:      features.length
          ? features
          : ["Managed by NizamKitchen", "Role-based access", "Secure billing records"],
        monthlyEquivalent,
        annualSavingsLabel,
      };
    });
}

// ── Comparison data ────────────────────────────────────────────────────────

type ComparisonRow = {
  label: string;
  household:     boolean;
  chef_staff:    boolean;
  home_catering: boolean;
  restaurant:    boolean;
};

const COMPARISON_GROUPS: { heading: string; rows: ComparisonRow[] }[] = [
  {
    heading: "Household tools",
    rows: [
      { label: "Weekly meal planning",     household: true,  chef_staff: false, home_catering: false, restaurant: false },
      { label: "Grocery list generation",  household: true,  chef_staff: false, home_catering: false, restaurant: false },
      { label: "Shopping budget tracking", household: true,  chef_staff: false, home_catering: false, restaurant: false },
      { label: "Request a home chef",      household: true,  chef_staff: false, home_catering: false, restaurant: false },
      { label: "Place food orders",        household: true,  chef_staff: false, home_catering: false, restaurant: false },
    ],
  },
  {
    heading: "Seller tools",
    rows: [
      { label: "Public profile listing",   household: false, chef_staff: true,  home_catering: true,  restaurant: true  },
      { label: "Menu management",          household: false, chef_staff: false, home_catering: true,  restaurant: true  },
      { label: "Order inbox & management", household: false, chef_staff: true,  home_catering: true,  restaurant: true  },
      { label: "Analytics & reporting",    household: false, chef_staff: false, home_catering: true,  restaurant: true  },
    ],
  },
  {
    heading: "Platform & security",
    rows: [
      { label: "Role-based team access",   household: true,  chef_staff: true,  home_catering: true,  restaurant: true  },
      { label: "Secure billing records",   household: true,  chef_staff: true,  home_catering: true,  restaurant: true  },
      { label: "In-app notifications",     household: true,  chef_staff: true,  home_catering: true,  restaurant: true  },
      { label: "Priority support",         household: false, chef_staff: false, home_catering: true,  restaurant: true  },
    ],
  },
];

type AudienceKey = keyof Omit<ComparisonRow, "label">;

const COMPARISON_AUDIENCES: { label: string; key: AudienceKey }[] = [
  { label: "Household",     key: "household"     },
  { label: "Home Chef",     key: "chef_staff"    },
  { label: "Home Catering", key: "home_catering" },
  { label: "Restaurant",    key: "restaurant"    },
];

// ── FAQ data ───────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Is there a free trial?",
    a: "Free-tier plans have no time limit — use them indefinitely. Paid plans are billed monthly with no lock-in; cancel anytime before your next billing date.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Upgrade or downgrade at any time from your account settings. Upgrades take effect immediately; downgrades apply at the end of your current billing period.",
  },
  {
    q: "How does billing work?",
    a: "Paid plans are billed monthly via Stripe. NizamKitchen never stores your card details — all payment data lives in Stripe's PCI-compliant vault. You receive an email receipt after each charge.",
  },
  {
    q: "What happens if I cancel?",
    a: "Your plan stays active until the end of the billing period you paid for. After that it reverts to the free tier. No data is deleted — reactivate at any time.",
  },
  {
    q: "Do chef, catering, and restaurant accounts require approval?",
    a: "Yes. All seller accounts go through platform verification before they appear publicly. Verification typically takes 1–2 business days.",
  },
  {
    q: "Is there a discount for annual billing?",
    a: "Yes — annual plans are available for Home Chef, Catering, and Restaurant accounts and save 20% compared to monthly billing. Toggle the Annual switch above the plan cards to see annual pricing. Household accounts are always free and have no billing.",
  },
];

// ── Page component ─────────────────────────────────────────────────────────

export default async function PricingPage() {
  const plans = await getPricingPlans();

  return (
    <main>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-[var(--color-border)] bg-white px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">

          {/* Trust indicators — first thing visitors see */}
          <div className="mb-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
              Stripe · PCI-compliant
            </span>
            <span aria-hidden="true" className="hidden text-slate-300 sm:inline">·</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
              No card data stored by NizamKitchen
            </span>
            <span aria-hidden="true" className="hidden text-slate-300 sm:inline">·</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <RefreshCw className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
              Cancel anytime
            </span>
          </div>

          <h1 className="font-serif text-4xl leading-tight text-slate-950 sm:text-5xl sm:leading-[1.1] lg:text-[56px]">
            Pricing that grows with your kitchen.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">
            Start free. Add meal planning, chef requests, catering, and restaurant operations exactly when you need them — no hidden fees.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="#plans"
              className={[
                "inline-flex items-center gap-2 rounded-xl px-5 py-2.5",
                "bg-[var(--color-primary)] text-sm font-semibold text-white shadow-sm",
                "transition-all duration-150 hover:bg-[var(--color-primary-strong)] active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              ].join(" ")}
            >
              View plans
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact?topic=enterprise"
              className={[
                "inline-flex items-center rounded-xl border border-slate-200 bg-white px-5 py-2.5",
                "text-sm font-semibold text-slate-600",
                "transition-all duration-150 hover:border-slate-300 hover:bg-slate-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              ].join(" ")}
            >
              Talk to sales
            </Link>
          </div>
        </div>
      </section>

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      <section id="plans" className="px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          {plans.length > 0 ? (
            <PricingPlans plans={plans} />
          ) : (
            <div className="mx-auto max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-10 text-center shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                Coming soon
              </p>
              <h2 className="mt-3 font-serif text-2xl text-slate-950">
                Public pricing is being finalized.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                The platform owner hasn&apos;t activated any public plans yet. Check back soon or contact us for early access.
              </p>
              <Link
                href="/contact?topic=pricing"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-strong)]"
              >
                Contact us
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Feature comparison ───────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] bg-white px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="font-serif text-2xl text-slate-950 sm:text-3xl">
              What&apos;s included in each account type.
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Compare features across every role on the platform.
            </p>
          </div>

          {/* Mobile: per-audience cards — never scrolls horizontally */}
          <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
            {COMPARISON_AUDIENCES.map(({ label, key }) => {
              const included = COMPARISON_GROUPS.flatMap((g) => g.rows).filter((r) => r[key]);
              return (
                <div
                  key={key}
                  className="rounded-xl border border-[var(--color-border)] bg-slate-50/60 p-4"
                >
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                    {label}
                  </p>
                  <ul className="space-y-2">
                    {included.map((f) => (
                      <li key={f.label} className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--color-primary)]"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        <span className="text-[13px] text-slate-600">{f.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Desktop: full comparison table */}
          <div className="hidden lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="w-[42%] pb-3 pr-6 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Feature
                  </th>
                  {(["Household", "Home Chef", "Catering", "Restaurant"] as const).map((col) => (
                    <th
                      key={col}
                      className="pb-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-700"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_GROUPS.map((group) => (
                  <Fragment key={group.heading}>
                    <tr>
                      <td
                        colSpan={5}
                        className="pb-1 pt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-primary)]"
                      >
                        {group.heading}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr
                        key={row.label}
                        className="border-t border-slate-100 transition-colors hover:bg-slate-50/60"
                      >
                        <td className="py-3 pr-6 text-[13px] font-medium text-slate-700">
                          {row.label}
                        </td>
                        {(["household", "chef_staff", "home_catering", "restaurant"] as const).map((col) => (
                          <td key={col} className="py-3 text-center">
                            {row[col] ? (
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)]/10"
                                aria-label="Included"
                              >
                                <Check
                                  className="h-3 w-3 text-[var(--color-primary)]"
                                  strokeWidth={2.5}
                                />
                              </span>
                            ) : (
                              <span
                                className="inline-block h-[3px] w-4 rounded-full bg-slate-200"
                                aria-label="Not included"
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-8 text-center font-serif text-2xl text-slate-950 sm:text-3xl">
            Common questions.
          </h2>

          <dl className="divide-y divide-[var(--color-border)]">
            {FAQ_ITEMS.map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary
                  className={[
                    "flex cursor-pointer list-none items-center justify-between gap-4",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:rounded",
                  ].join(" ")}
                >
                  <dt className="text-sm font-semibold text-slate-900">{q}</dt>
                  <span
                    aria-hidden="true"
                    className={[
                      "flex h-5 w-5 flex-none items-center justify-center rounded-full",
                      "bg-slate-100 text-slate-400 transition-transform duration-200 group-open:rotate-45",
                    ].join(" ")}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="5" y1="1" x2="5" y2="9" />
                      <line x1="1" y1="5" x2="9" y2="5" />
                    </svg>
                  </span>
                </summary>
                <dd className="mt-2.5 text-sm leading-6 text-slate-500">{a}</dd>
              </details>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--color-border)] px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl bg-slate-950 px-8 py-12 text-center sm:px-12">
            <h2 className="font-serif text-2xl text-white sm:text-3xl">
              Start building your kitchen operation today.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
              Free household plan — no credit card required.
              Seller accounts include a full-featured dashboard.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/register"
                className={[
                  "inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5",
                  "text-sm font-semibold text-slate-950 shadow-sm",
                  "transition-all duration-150 hover:bg-slate-100 active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                ].join(" ")}
              >
                Create free account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact?topic=enterprise"
                className={[
                  "inline-flex items-center rounded-xl border border-slate-700 px-5 py-2.5",
                  "text-sm font-semibold text-slate-400",
                  "transition-all duration-150 hover:border-slate-500 hover:text-slate-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                ].join(" ")}
              >
                Talk to sales
              </Link>
            </div>
            <p className="mt-5 text-[11px] text-slate-600">
              Operator accounts require platform verification — typically 1–2 business days.
            </p>
          </div>
        </div>
      </section>

    </main>
  );
}
