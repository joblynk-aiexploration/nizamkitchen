import Link from "next/link";
import { ArrowRight, ChefHat, Search, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";

type MarketplaceKind = "overview" | "chefs" | "caterers" | "restaurants" | "dishes";

const categories = [
  {
    href: "/marketplace/chefs",
    label: "Home Chefs",
    description: "Browse platform-reviewed independent chefs for in-home cooking requests.",
    icon: ChefHat,
  },
  {
    href: "/marketplace/caterers",
    label: "Home Catering",
    description: "Find home catering sellers for pickup, delivery, and preorder dishes.",
    icon: ShoppingBag,
  },
  {
    href: "/marketplace/restaurants",
    label: "Restaurants",
    description: "Explore restaurant partners when ordering prepared food is the better fit.",
    icon: Store,
  },
  {
    href: "/marketplace/dishes",
    label: "Dishes",
    description: "Discover Hyderabadi dishes across recipes, menus, chefs, and sellers.",
    icon: UtensilsCrossed,
  },
];

const pageCopy: Record<MarketplaceKind, {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}> = {
  overview: {
    eyebrow: "Marketplace",
    title: "Browse chefs, caterers, restaurants, and dishes from one place.",
    description:
      "NizamKitchen keeps public marketplace discovery separate from private household, seller, and admin workspaces. Start broad, then open the category that fits what you need.",
    primaryHref: "/marketplace/dishes",
    primaryLabel: "Browse dishes",
    secondaryHref: "/recipes",
    secondaryLabel: "View recipe library",
  },
  chefs: {
    eyebrow: "Home chef marketplace",
    title: "Request a chef to cook in your home.",
    description:
      "Home Chef means the chef comes to the customer home and cooks in the customer kitchen. Public listings show only safe marketplace details before a request is accepted.",
    primaryHref: "/chefs",
    primaryLabel: "Open chef listings",
    secondaryHref: "/for-chefs",
    secondaryLabel: "Chef information",
  },
  caterers: {
    eyebrow: "Home catering marketplace",
    title: "Order prepared food from home catering sellers.",
    description:
      "Home Catering sellers cook from their own kitchen and offer prepared dishes for pickup, delivery, or preorder after platform review.",
    primaryHref: "/caterers",
    primaryLabel: "Open caterer listings",
    secondaryHref: "/for-households",
    secondaryLabel: "For households",
  },
  restaurants: {
    eyebrow: "Restaurant marketplace",
    title: "Find restaurant options for prepared food orders.",
    description:
      "Restaurant pages are for restaurant-owned menus and prepared food from restaurant locations. They are separate from home catering and home chef requests.",
    primaryHref: "/restaurants",
    primaryLabel: "Open restaurant listings",
    secondaryHref: "/for-restaurants",
    secondaryLabel: "Restaurant information",
  },
  dishes: {
    eyebrow: "Dish discovery",
    title: "Explore Hyderabadi dishes before you plan, hire, or order.",
    description:
      "Dish discovery connects the Plan, Cook, Hire, and Order journey without exposing private menus or customer information. Start with public recipes while marketplace menus continue to grow.",
    primaryHref: "/recipes",
    primaryLabel: "Open recipe library",
    secondaryHref: "/marketplace",
    secondaryLabel: "Marketplace overview",
  },
};

export function PublicMarketplacePage({ kind = "overview" }: { kind?: MarketplaceKind }) {
  const copy = pageCopy[kind];

  return (
    <div className="bg-slate-50">
      <section className="px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
              {copy.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight text-[var(--color-ink)] sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
              {copy.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={copy.primaryHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              >
                {copy.primaryLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href={copy.secondaryHref}
                className="inline-flex min-h-11 items-center rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--color-ink)] shadow-sm transition hover:border-[var(--color-primary)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              >
                {copy.secondaryLabel}
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">Public marketplace search</p>
                <p className="text-xs text-[var(--color-muted)]">Private household and seller data stays protected.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {categories.map((category) => {
                const Icon = category.icon;
                const active = category.href.endsWith(kind);
                return (
                  <Link
                    key={category.href}
                    href={category.href}
                    className={`flex items-start gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 ${
                      active ? "border-emerald-300 bg-emerald-50" : "border-[var(--color-border)] bg-white"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[var(--color-primary)]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--color-ink)]">{category.label}</span>
                      <span className="mt-1 block text-sm leading-6 text-[var(--color-muted)]">{category.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
