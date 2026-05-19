import Link from "next/link";
import { ArrowRight, CalendarDays, ChefHat, ShoppingCart, UtensilsCrossed } from "lucide-react";

const benefits = [
  {
    icon: CalendarDays,
    title: "Plan your week in minutes",
    body: "Build a full week of meals from our Hyderabadi recipe library. The planner handles portions, scales recipes, and ensures variety.",
  },
  {
    icon: UtensilsCrossed,
    title: "Cook with confidence",
    body: "Step-by-step recipes scaled to your household size. Filter out ingredients your family can't or won't eat — automatically.",
  },
  {
    icon: ShoppingCart,
    title: "Never forget an ingredient",
    body: "Your meal plan becomes a categorised grocery list instantly. Share it with anyone or print it before heading to the market.",
  },
  {
    icon: ChefHat,
    title: "Hire a chef for special occasions",
    body: "When you want an unforgettable home meal without the effort, book a verified home chef from your city.",
  },
];

export default function ForHouseholdsPage() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Hero */}
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              For households
            </p>
            <h1 className="mt-4 font-serif text-4xl text-[var(--color-ink)] sm:text-5xl">
              Your household kitchen, organised at last.
            </h1>
            <p className="mt-5 text-lg text-[var(--color-muted)]">
              Whether you cook every night or only on weekends, NizamKitchen helps your household eat better,
              waste less, and spend more time at the table and less time planning.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register?type=household"
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                Create household account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
              >
                See pricing
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

        {/* Hyderabadi focus */}
        <div className="mt-20 rounded-3xl bg-slate-50 px-8 py-12 text-center">
          <h2 className="font-serif text-3xl text-[var(--color-ink)]">
            Rooted in Hyderabadi culinary tradition.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--color-muted)]">
            Every recipe in NizamKitchen is authentic and carefully curated — from slow-cooked biryani to
            haleem and bagara baingan. We bring the richness of Hyderabad&apos;s food culture into your home kitchen.
          </p>
          <Link
            href="/features"
            className="mt-6 inline-flex rounded-2xl bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Explore all features
          </Link>
        </div>
      </div>
    </div>
  );
}
