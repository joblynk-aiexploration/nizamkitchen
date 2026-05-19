import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "forever",
    description: "Everything a household needs to get started.",
    cta: "Get started free",
    href: "/register?type=household",
    highlight: false,
    limits: [
      "Up to 3 meal plans",
      "Up to 10 grocery lists per month",
      "Up to 4 household members",
      "Up to 10 saved restaurants",
      "Basic recipe library",
      "Grocery list sharing",
    ],
  },
  {
    name: "Family Plus",
    price: "₹299",
    period: "per month",
    description: "For active households that cook seriously.",
    cta: "Start free trial",
    href: "/register?type=household",
    highlight: true,
    limits: [
      "Unlimited meal plans",
      "Unlimited grocery lists",
      "Up to 10 household members",
      "Unlimited saved restaurants",
      "Full recipe library + video guides",
      "Chef marketplace access",
      "Restaurant fallback search",
      "Advanced grocery exports",
      "Household activity reports",
    ],
  },
  {
    name: "Chef Business",
    price: "₹199",
    period: "per month",
    description: "For home chefs running a cooking business.",
    cta: "Apply as chef",
    href: "/register?type=chef",
    highlight: false,
    limits: [
      "Chef profile and marketplace listing",
      "Booking and request management",
      "Service and availability calendar",
      "Review and rating system",
      "Chef analytics dashboard",
      "Business branding tools",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Simple pricing
          </p>
          <h1 className="mt-3 font-serif text-4xl text-[var(--color-ink)] sm:text-5xl">
            Plans that grow with your kitchen.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--color-muted)]">
            Start free. Upgrade when you need more. No hidden fees, no credit card required to begin.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.highlight
                  ? "rounded-3xl bg-[linear-gradient(145deg,#10263a,#1d3f5f)] p-8 text-white shadow-xl ring-2 ring-[var(--color-primary)]"
                  : "rounded-3xl border border-[var(--color-border)] p-8"
              }
            >
              {plan.highlight && (
                <span className="mb-4 inline-block rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Most popular
                </span>
              )}
              <h2 className="font-serif text-2xl">{plan.name}</h2>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className={`mb-1 text-sm ${plan.highlight ? "text-slate-300" : "text-[var(--color-muted)]"}`}>
                  / {plan.period}
                </span>
              </div>
              <p className={`mt-3 text-sm ${plan.highlight ? "text-slate-300" : "text-[var(--color-muted)]"}`}>
                {plan.description}
              </p>

              <Link
                href={plan.href}
                className={
                  plan.highlight
                    ? "mt-6 block rounded-2xl bg-white px-6 py-3 text-center text-sm font-semibold text-[#10263a] hover:opacity-90"
                    : "mt-6 block rounded-2xl border border-[var(--color-border)] px-6 py-3 text-center text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
                }
              >
                {plan.cta}
              </Link>

              <ul className="mt-8 space-y-3">
                {plan.limits.map((l) => (
                  <li key={l} className="flex items-start gap-2 text-sm">
                    <span className={plan.highlight ? "text-emerald-400" : "text-emerald-500"}>✓</span>
                    <span className={plan.highlight ? "text-slate-200" : "text-[var(--color-muted)]"}>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-[var(--color-muted)]">
          Restaurant partner plans available.{" "}
          <Link href="/contact" className="font-semibold text-[var(--color-primary)] hover:underline">
            Contact us
          </Link>{" "}
          to learn more.
        </p>
      </div>
    </div>
  );
}
