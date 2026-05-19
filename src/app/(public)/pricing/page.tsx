import Link from "next/link";

const plans = [
  {
    name: "Household Free/Starter",
    price: "Free",
    period: "during beta",
    description: "For households starting with recipes, meal plans, and grocery lists.",
    cta: "Start beta",
    href: "/register?type=household",
    highlight: false,
    badge: "Beta access",
    limits: [
      "Hyderabadi starter recipe catalog",
      "Meal planning and grocery list basics",
      "Household profile and preferences",
      "Favorite recipes and avoided ingredient warnings",
      "Shareable grocery lists",
    ],
  },
  {
    name: "Family Plus",
    price: "Beta",
    period: "waitlist pricing",
    description: "For families that cook often and want more planning power.",
    cta: "Start beta",
    href: "/register?type=household",
    highlight: true,
    badge: "Most popular",
    limits: [
      "Everything in Household Free/Starter",
      "Expanded meal planning workflows",
      "Advanced grocery exports",
      "Home chef request access",
      "Restaurant fallback tools",
      "Priority beta feedback review",
    ],
  },
  {
    name: "Premium Household",
    price: "Coming soon",
    period: "after beta",
    description: "For households that want the full Plan, Cook, Hire, Order experience.",
    cta: "Coming soon",
    href: "/contact?topic=premium-household",
    highlight: false,
    badge: "Roadmap",
    limits: [
      "Premium household controls",
      "Advanced pantry and shopping preferences",
      "Deeper home chef coordination",
      "More export and sharing options",
      "Early access to future household tools",
    ],
  },
  {
    name: "Chef Business",
    price: "Waitlist",
    period: "manual approval",
    description: "For home chefs who want a profile, services, requests, and reviews.",
    cta: "Join waitlist",
    href: "/register?type=chef",
    highlight: false,
    badge: "Manual verification",
    limits: [
      "Chef profile and service setup",
      "Availability and specialty dishes",
      "Assigned request management",
      "Admin review before public visibility",
      "No payment processing in beta",
    ],
  },
  {
    name: "Home Catering Seller",
    price: "Waitlist",
    period: "manual approval",
    description: "For sellers preparing dishes from home or small kitchens for pickup, delivery, or pre-order.",
    cta: "Join waitlist",
    href: "/register?type=catering",
    highlight: false,
    badge: "New seller path",
    limits: [
      "Home catering profile setup",
      "City-level service area and specialties",
      "Pickup, delivery, and preorder preferences",
      "Admin review before public visibility",
      "Menu and order requests coming later",
    ],
  },
  {
    name: "Restaurant Partner",
    price: "Waitlist",
    period: "partner review",
    description: "For restaurants that want to be discoverable when households order instead.",
    cta: "Join waitlist",
    href: "/register?type=restaurant",
    highlight: false,
    badge: "Partner program",
    limits: [
      "Restaurant partner interest intake",
      "Saved restaurant visibility foundation",
      "No fake ratings or invented review data",
      "No live ordering or checkout yet",
      "Flexible country-by-country rollout",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "for operators",
    description: "For larger partners, country operations, and custom deployments.",
    cta: "Contact us",
    href: "/contact?topic=enterprise",
    highlight: false,
    badge: "Custom",
    limits: [
      "Multi-country operating support",
      "Admin controls and audit logs",
      "Deployment and integration planning",
      "Support workflow coordination",
      "Security and compliance review",
    ],
  },
];

const trustNotes = [
  "No live payments or checkout are connected yet.",
  "Chef profiles require admin review before public marketplace visibility.",
  "Restaurant fallback avoids fake ratings, fake photos, and invented claims.",
  "Grocery lists are planning estimates and should be checked before shopping.",
];

export default function PricingPage() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Beta pricing
          </p>
          <h1 className="mt-3 font-serif text-4xl text-[var(--color-ink)] sm:text-5xl">
            Simple plans for the Plan, Cook, Hire, Order journey.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--color-muted)]">
            Start with household beta access today. Chef, restaurant, premium, and enterprise
            options are waitlist or contact-led while NizamKitchen prepares for public launch.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.highlight
                  ? "rounded-3xl bg-[linear-gradient(145deg,#10263a,#1d3f5f)] p-8 text-white shadow-xl ring-2 ring-[var(--color-primary)]"
                  : "rounded-3xl border border-[var(--color-border)] bg-white p-8 shadow-sm"
              }
            >
              <span
                className={
                  plan.highlight
                    ? "mb-4 inline-block rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300"
                    : "mb-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]"
                }
              >
                {plan.badge}
              </span>
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
                {plan.limits.map((limit) => (
                  <li key={limit} className="flex items-start gap-2 text-sm">
                    <span className={plan.highlight ? "text-emerald-400" : "text-emerald-500"}>✓</span>
                    <span className={plan.highlight ? "text-slate-200" : "text-[var(--color-muted)]"}>{limit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-serif text-2xl text-amber-950">Clear beta expectations</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {trustNotes.map((note) => (
              <p key={note} className="rounded-2xl bg-white/70 px-4 py-3 text-sm text-amber-900">
                {note}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
