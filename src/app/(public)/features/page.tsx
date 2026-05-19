import Link from "next/link";
import {
  BarChart3, BookOpen, CalendarDays, ChefHat, Globe2, ShieldCheck,
  ShoppingCart, Star, UtensilsCrossed,
} from "lucide-react";

const sections = [
  {
    category: "Meal Planning",
    icon: CalendarDays,
    features: [
      "Weekly and monthly meal plan builder",
      "Authentic Hyderabadi recipe catalog",
      "Household size scaling for all recipes",
      "Avoided ingredient filtering",
      "Spice level preferences per household",
      "Favourite recipe library",
    ],
  },
  {
    category: "Grocery Engine",
    icon: ShoppingCart,
    features: [
      "Auto-generated grocery lists from meal plans",
      "Item categorisation by aisle or food group",
      "Shareable lists via public link",
      "CSV and print-friendly export",
      "Partner grocery store integration",
    ],
  },
  {
    category: "Recipe Library",
    icon: BookOpen,
    features: [
      "Curated Hyderabadi recipe collection",
      "Step-by-step cooking instructions",
      "Ingredient and unit management",
      "Verified recipe video references",
      "Recipe difficulty and cook-time metadata",
    ],
  },
  {
    category: "Home Chef Marketplace",
    icon: ChefHat,
    features: [
      "Browse manually reviewed home chefs in your city",
      "Request-based booking system",
      "Chef profiles with specialties and request history",
      "Match households with available chefs",
      "Chef business tools and availability calendar",
    ],
  },
  {
    category: "Restaurant Fallback",
    icon: UtensilsCrossed,
    features: [
      "Discover nearby restaurant options",
      "Save favourite restaurants",
      "Search by cuisine, city, or name",
      "No fake restaurant ratings or invented review data",
    ],
  },
  {
    category: "Analytics & Insights",
    icon: BarChart3,
    features: [
      "Household cooking activity reports",
      "Most cooked recipes and favourites",
      "Grocery spending by category",
      "Restaurant search history",
      "Home chef request tracking",
    ],
  },
  {
    category: "Security & Privacy",
    icon: ShieldCheck,
    features: [
      "Multi-tenant data isolation",
      "Role-based access control",
      "Full audit trail for all events",
      "Country-level data scoping",
      "Session-based authentication",
    ],
  },
  {
    category: "Multi-Country",
    icon: Globe2,
    features: [
      "Country-specific currency and timezone",
      "Metric and imperial measurement systems",
      "Country manager admin role",
      "Localisation-ready architecture",
    ],
  },
  {
    category: "Ratings & Reviews",
    icon: Star,
    features: [
      "Chef review and rating system",
      "Verified review from completed bookings",
      "Average rating displayed on chef profiles",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Everything you need
          </p>
          <h1 className="mt-3 font-serif text-4xl text-[var(--color-ink)] sm:text-5xl">
            Features built for the modern household kitchen.
          </h1>
          <p className="mt-5 text-lg text-[var(--color-muted)]">
            From meal planning to grocery lists, cooking mode, home chef requests, and restaurant fallback,
            NizamKitchen follows the real household flow: Plan → Cook → Hire → Order.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.category} className="rounded-3xl border border-[var(--color-border)] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-semibold text-[var(--color-ink)]">{section.category}</h2>
                </div>
                <ul className="mt-5 space-y-2">
                  {section.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
                      <span className="mt-0.5 text-emerald-500">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-16 rounded-3xl bg-[linear-gradient(135deg,#10263a_0%,#0f766e_100%)] px-8 py-12 text-center text-white">
          <h2 className="font-serif text-3xl">Start beta. No payment setup needed.</h2>
          <p className="mt-3 text-slate-200">
            Create your household account and start planning meals in beta today.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex rounded-2xl bg-white px-8 py-3 text-sm font-semibold text-[#10263a] hover:opacity-90"
          >
            Start beta
          </Link>
        </div>
      </div>
    </div>
  );
}
