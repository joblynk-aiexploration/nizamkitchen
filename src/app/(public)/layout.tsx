import Link from "next/link";
import { PublicNav } from "@/components/public/public-nav";
import { getCurrentSession } from "@/lib/auth/session";
import { organizationJsonLd, websiteJsonLd } from "@/server/seo/seo-service";

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const footerSections = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/pricing", label: "Pricing" },
      { href: "/for-households", label: "For Households" },
    ],
  },
  {
    title: "Marketplace",
    links: [
      { href: "/marketplace/chefs", label: "Home Chefs" },
      { href: "/marketplace/caterers", label: "Home Catering" },
      { href: "/marketplace/restaurants", label: "Restaurants" },
      { href: "/marketplace/dishes", label: "Dishes" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/help", label: "Help Center" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/cookie-policy", label: "Cookie Policy" },
      { href: "/legal/seller-agreement", label: "Seller Agreement" },
      { href: "/legal/food-safety", label: "Food Safety" },
    ],
  },
];

function dashboardHrefForSession(session: Awaited<ReturnType<typeof getCurrentSession>>) {
  if (!session) return null;

  if (session.user.platformRole) return "/admin";

  switch (session.activeOrganization?.organizationType) {
    case "chef_business":
      return "/chef";
    case "home_catering":
      return "/catering";
    case "restaurant":
      return "/restaurant";
    default:
      return "/dashboard";
  }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession().catch(() => null);
  const dashboardHref = dashboardHrefForSession(session);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: jsonLd([organizationJsonLd(), websiteJsonLd()]) }}
      />
      <PublicNav dashboardHref={dashboardHref} />
      <main className="flex-1">{children}</main>
      <footer data-testid="public-footer" className="relative z-10 border-t border-[var(--color-border)] bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] text-xs font-bold text-white shadow">
                  NK
                </div>
                <span className="font-serif text-lg text-[var(--color-ink)]">NizamKitchen</span>
              </div>
              <p className="mt-3 text-sm text-[var(--color-muted)]">
                Plan, cook, hire, or order — built around authentic Hyderabadi food.
              </p>
            </div>
            {footerSections.map((section) => (
              <div key={section.title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex rounded-lg py-1 text-[var(--color-muted)] transition hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 border-t border-[var(--color-border)] pt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} NizamKitchen. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
