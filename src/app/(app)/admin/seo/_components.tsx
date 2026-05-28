import Link from "next/link";
import { cn } from "@/lib/utils";

export const seoTabs = [
  { href: "/admin/seo", label: "Overview" },
  { href: "/admin/seo/global", label: "Global" },
  { href: "/admin/seo/pages", label: "Pages" },
  { href: "/admin/seo/recipes", label: "Recipes" },
  { href: "/admin/seo/seller-profiles", label: "Seller Profiles" },
  { href: "/admin/seo/sitemaps", label: "Sitemaps" },
  { href: "/admin/seo/schema", label: "Schema" },
  { href: "/admin/seo/google", label: "Google" },
] as const;

export function SeoTabs({ active }: { active: (typeof seoTabs)[number]["href"] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-[var(--color-border)] bg-white p-2">
      <nav className="flex min-w-max gap-2">
        {seoTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-2xl px-4 py-2 text-sm font-semibold transition",
              active === tab.href
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-muted)] hover:bg-slate-50 hover:text-[var(--color-ink)]",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function seoScopeLabel(value: string) {
  return value.replace(/_/g, " ");
}
