import Link from "next/link";
import { ArrowRight, CalendarDays, ChefHat, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { publicPageMetadata } from "@/lib/seo/public-page-metadata";

export const generateMetadata = () => publicPageMetadata("/");

const steps = [
  {
    icon: CalendarDays,
    label: "Plan",
    heading: "Plan real Hyderabadi meals",
    body: "Build weekly plans around biryani, khatti dal, salan, snacks, sweets, and everyday family favorites.",
  },
  {
    icon: UtensilsCrossed,
    label: "Cook",
    heading: "Cook with recipes and videos",
    body: "Follow step-by-step recipes, verified video references, household servings, and grocery lists you can take to the store.",
  },
  {
    icon: ChefHat,
    label: "Hire",
    heading: "Request a home chef",
    body: "When you want help for an occasion or weekly cooking, send a manual request to a verified home chef.",
  },
  {
    icon: ShoppingCart,
    label: "Order",
    heading: "Order instead",
    body: "When cooking isn't the answer, discover nearby restaurant options without fake ratings or invented claims.",
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

const trustPillars = [
  {
    title: "Verified recipe videos",
    body: "Household recipe pages only show video references after they pass availability and safety checks.",
  },
  {
    title: "No fake restaurant ratings",
    body: "Restaurant fallback avoids invented review scores, fake photos, and claims NizamKitchen cannot verify.",
  },
  {
    title: "Private by design",
    body: "Household preferences, meal plans, grocery lists, and requests stay scoped to the right organization.",
  },
  {
    title: "Manual chef verification",
    body: "Chef profiles are reviewed by platform staff before they become publicly visible to households.",
  },
  {
    title: "Grocery estimates",
    body: "Generated lists are helpful planning tools, but households should check quantities before shopping.",
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
            Plan dinner, cook with confidence, and keep a backup plan.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-200">
            NizamKitchen helps Hyderabadi households plan meals, generate groceries, cook with real
            recipes and videos, hire home chefs, or order instead.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#10263a] shadow-lg hover:opacity-90"
            >
              Start beta
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

      {/* ── Trust and safety ── */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              Trust and safety
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[var(--color-ink)] sm:text-4xl">
              Built for real households, not fake marketplace noise.
            </h2>
            <p className="mt-4 text-[var(--color-muted)]">
              NizamKitchen is designed to be honest about what is verified, what is estimated,
              and what still needs a person in the loop.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {trustPillars.map((pillar) => (
              <div key={pillar.title} className="rounded-3xl border border-[var(--color-border)] bg-white p-5">
                <h3 className="font-serif text-lg text-[var(--color-ink)]">{pillar.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl bg-[linear-gradient(135deg,#10263a_0%,#0f766e_100%)] px-8 py-14 text-center text-white">
          <h2 className="font-serif text-3xl sm:text-4xl">
            Ready to transform your kitchen?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-200">
            Join the beta and help shape the kitchen operating system for Hyderabadi households.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3 text-sm font-semibold text-[#10263a] hover:opacity-90"
          >
            Start beta
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
