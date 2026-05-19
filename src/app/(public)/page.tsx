import Link from "next/link";
import { ArrowRight, CalendarDays, ChefHat, ShoppingCart, UtensilsCrossed } from "lucide-react";

const steps = [
  {
    icon: CalendarDays,
    label: "Plan",
    heading: "Smart meal planning",
    body: "Build weekly meal plans from authentic Hyderabadi recipes. Get nutritional guidance and avoid ingredients your household can't eat.",
  },
  {
    icon: UtensilsCrossed,
    label: "Cook",
    heading: "Step-by-step recipes",
    body: "Cook at home with confidence. Recipes scale to your household size and auto-generate a grocery list you can share.",
  },
  {
    icon: ChefHat,
    label: "Hire",
    heading: "Book a home chef",
    body: "When you want restaurant-quality food at home, browse verified chefs available in your city and book them for any occasion.",
  },
  {
    icon: ShoppingCart,
    label: "Order",
    heading: "Order instead",
    body: "When cooking isn't the answer, discover partner restaurants nearby and save your favourites for next time.",
  },
];

const audiences = [
  {
    slug: "/for-households",
    label: "For Households",
    description: "Plan meals, manage your kitchen, and feed your family with less stress and more flavour.",
    cta: "Start cooking →",
  },
  {
    slug: "/for-chefs",
    label: "For Home Chefs",
    description: "Run your cooking business, manage bookings, and reach families who want authentic home-cooked food.",
    cta: "Grow your business →",
  },
  {
    slug: "/for-restaurants",
    label: "For Restaurants",
    description: "Partner with NizamKitchen and reach households looking to order when home cooking isn't an option.",
    cta: "Become a partner →",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="bg-[linear-gradient(145deg,#10263a_0%,#1d3f5f_55%,#0f766e_100%)] px-5 py-20 text-white sm:px-8 sm:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
            Plan · Cook · Hire · Order
          </p>
          <h1 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
            Cook more of what you love.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-200">
            NizamKitchen helps households plan meals, cook authentic Hyderabadi food, hire home chefs,
            or order from local restaurants — all in one place.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#10263a] shadow-lg hover:opacity-90"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/18"
            >
              See all features
            </Link>
          </div>
        </div>
      </section>

      {/* ── Funnel steps ── */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">How it works</p>
            <h2 className="mt-3 font-serif text-3xl text-[var(--color-ink)] sm:text-4xl">
              One kitchen. Every possibility.
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="rounded-3xl border border-[var(--color-border)] p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-serif text-xl text-[var(--color-ink)]">{step.heading}</h3>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">{step.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Audience sections ── */}
      <section className="bg-slate-50 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">Built for everyone</p>
            <h2 className="mt-3 font-serif text-3xl text-[var(--color-ink)] sm:text-4xl">
              Who is NizamKitchen for?
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {audiences.map((a) => (
              <div key={a.slug} className="rounded-3xl border border-[var(--color-border)] bg-white p-8">
                <h3 className="font-serif text-2xl text-[var(--color-ink)]">{a.label}</h3>
                <p className="mt-3 text-sm text-[var(--color-muted)]">{a.description}</p>
                <Link
                  href={a.slug}
                  className="mt-6 inline-flex items-center text-sm font-semibold text-[var(--color-primary)] hover:underline"
                >
                  {a.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl bg-[linear-gradient(135deg,#10263a_0%,#0f766e_100%)] px-8 py-14 text-center text-white">
          <h2 className="font-serif text-3xl sm:text-4xl">
            Ready to transform your kitchen?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-200">
            Join households already using NizamKitchen to eat better, cook smarter, and stress less.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3 text-sm font-semibold text-[#10263a] hover:opacity-90"
          >
            Create your free account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
