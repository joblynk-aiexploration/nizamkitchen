import Link from "next/link";
import { ArrowRight, Globe2, ShoppingCart, TrendingUp, Users } from "lucide-react";

const benefits = [
  {
    icon: Users,
    title: "Reach cooking households",
    body: "When households decide not to cook, NizamKitchen shows them restaurants nearby. Be the one they find.",
  },
  {
    icon: Globe2,
    title: "Geo-powered discovery",
    body: "Your restaurant appears in location-based search results powered by MapTiler, reaching households in your city.",
  },
  {
    icon: ShoppingCart,
    title: "Saved by real customers",
    body: "Households save their favourite restaurants for repeat orders. Get on their saved list and stay top of mind.",
  },
  {
    icon: TrendingUp,
    title: "Performance insights",
    body: "Platform admins track restaurant search and discovery metrics so partners understand their reach.",
  },
];

export default function ForRestaurantsPage() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Hero */}
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              For restaurants
            </p>
            <h1 className="mt-4 font-serif text-4xl text-[var(--color-ink)] sm:text-5xl">
              Be the restaurant families choose when they don&apos;t cook.
            </h1>
            <p className="mt-5 text-lg text-[var(--color-muted)]">
              NizamKitchen households plan meals daily. When a meal plan falls through, they need a restaurant fast.
              Partner with us to be their first recommendation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register?type=restaurant"
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Apply as a restaurant partner
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
              >
                Talk to us first
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="rounded-3xl border border-[var(--color-border)] p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-[var(--color-ink)]">{b.title}</h3>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">{b.body}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Partnership CTA */}
        <div className="mt-20 rounded-3xl bg-slate-50 px-8 py-12 text-center">
          <h2 className="font-serif text-3xl text-[var(--color-ink)]">
            Ready to become a partner?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--color-muted)]">
            Restaurant partnerships are currently invitation-only in select cities.
            Register your interest and we will be in touch.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/register?type=restaurant"
              className="inline-flex rounded-2xl bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Register interest
            </Link>
            <Link
              href="/contact"
              className="inline-flex rounded-2xl border border-[var(--color-border)] px-8 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-white"
            >
              Contact our team
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
