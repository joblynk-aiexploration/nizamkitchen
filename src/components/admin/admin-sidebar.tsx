"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ChefHat,
  CircleDollarSign,
  Flag,
  Globe2,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Logs,
  Ruler,
  Scale,
  Settings,
  Shield,
  ServerCog,
  ShoppingCart,
  UtensilsCrossed,
  UserRoundSearch,
  Users,
  TvMinimalPlay,
} from "lucide-react";
import type { getCurrentSession } from "@/lib/session";
import { cn } from "@/lib/utils";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

const adminNavGroups = [
  {
    title: "Platform",
    items: [
      { href: "/admin", label: "Admin Overview", icon: LayoutDashboard },
      { href: "/admin/organizations", label: "Organizations", icon: Building2 },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/countries", label: "Countries", icon: Globe2 },
      { href: "/admin/my-countries", label: "My countries", icon: Shield },
      { href: "/admin/feature-flags", label: "Feature Flags", icon: Flag },
      { href: "/admin/access-control", label: "Access Control / RBAC", icon: Shield },
      { href: "/admin/policies", label: "Policies", icon: Settings },
      { href: "/admin/system", label: "System Health", icon: ServerCog },
      { href: "/admin/audit-logs", label: "Audit logs", icon: Logs },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/admin/apis", label: "API Management", icon: ServerCog },
      { href: "/admin/system-settings", label: "System Settings", icon: Settings },
      { href: "/admin/seo", label: "SEO / AEO", icon: Globe2 },
      { href: "/admin/legal", label: "Legal Center", icon: Scale },
      { href: "/admin/localization", label: "Localization", icon: Globe2 },
    ],
  },
  {
    title: "Food Platform",
    items: [
      { href: "/admin/recipe-library", label: "Recipe library", icon: BookOpen },
      { href: "/admin/ingredients", label: "Ingredients", icon: ChefHat },
      { href: "/admin/units", label: "Units", icon: Ruler },
      { href: "/admin/cuisines", label: "Cuisines", icon: UtensilsCrossed },
      { href: "/admin/templates", label: "Dish/Menu Templates", icon: BookOpen },
      { href: "/admin/youtube-discovery", label: "YouTube discovery", icon: TvMinimalPlay },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/admin/home-chef-requests", label: "Home chef requests", icon: UtensilsCrossed },
      { href: "/admin/chefs", label: "Chefs", icon: ChefHat },
      { href: "/admin/home-catering", label: "Home catering", icon: Building2 },
      { href: "/admin/restaurants", label: "Restaurants", icon: Building2 },
      { href: "/admin/menus", label: "Menus", icon: ShoppingCart },
      { href: "/admin/menu-items", label: "Menu items", icon: ShoppingCart },
      { href: "/admin/food-orders", label: "Food orders", icon: Inbox },
      { href: "/admin/meal-planner", label: "Meal planner", icon: CalendarDays },
      { href: "/admin/restaurant-fallback", label: "Restaurant fallback", icon: ShoppingCart },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/payments", label: "Payments", icon: CircleDollarSign },
      { href: "/admin/billing", label: "Billing", icon: CircleDollarSign },
      { href: "/admin/accounting", label: "Accounting", icon: Scale },
      { href: "/admin/storage", label: "Storage", icon: ServerCog },
      { href: "/admin/dropbox", label: "Admin Dropbox", icon: FolderOpen },
      { href: "/admin/verifications", label: "Seller Verification / KYC", icon: Shield },
      { href: "/admin/kyc", label: "KYC Providers", icon: Shield },
      { href: "/admin/grocery-engine", label: "Grocery Engine", icon: ShoppingCart },
      { href: "/admin/grocery-partners", label: "Grocery Partners", icon: Building2 },
      { href: "/admin/support", label: "Support", icon: UserRoundSearch },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/notifications", label: "Notifications", icon: Inbox },
    ],
  },
  {
    title: "Public Site",
    items: [
      { href: "/admin/content", label: "CMS / Help Center", icon: BookOpen },
      { href: "/admin/leads", label: "Leads", icon: Inbox },
    ],
  },
];

function canSeeLink(session: Session, href: string) {
  const role = session.user.platformRole;

  if (!role) {
    return false;
  }

  if (href === "/admin/my-countries") {
    return role === "country_manager" || role === "platform_owner" || role === "platform_admin";
  }

  if (role === "country_manager") {
    return [
      "/admin",
      "/admin/my-countries",
      "/admin/countries",
      "/admin/organizations",
      "/admin/users",
      "/admin/audit-logs",
      "/admin/reports",
      "/admin/home-chef-requests",
      "/admin/chefs",
      "/admin/verifications",
      "/admin/verifications/requirements",
      "/admin/home-catering",
      "/admin/menu-items",
      "/admin/food-orders",
      "/admin/restaurant-fallback",
      "/admin/grocery-partners",
      "/admin/dropbox",
      "/admin/dropbox/files",
      "/admin/dropbox/folders",
      "/admin/payments",
      "/admin/payments/operations",
      "/admin/payments/configurations",
      "/admin/payments/transactions",
      "/admin/payments/commissions",
    ].includes(href);
  }

  if (role === "support_admin") {
    return [
      "/admin",
      "/admin/organizations",
      "/admin/users",
      "/admin/audit-logs",
      "/admin/home-chef-requests",
      "/admin/chefs",
      "/admin/verifications",
      "/admin/home-catering",
      "/admin/menu-items",
      "/admin/food-orders",
      "/admin/support",
      "/admin/leads",
      "/admin/dropbox",
      "/admin/dropbox/files",
      "/admin/dropbox/folders",
      "/admin/payments",
      "/admin/payments/operations",
      "/admin/payments/transactions",
    ].includes(href);
  }

  if (role === "auditor") {
    return [
      "/admin",
      "/admin/organizations",
      "/admin/users",
      "/admin/audit-logs",
      "/admin/payments",
      "/admin/payments/transactions",
    ].includes(href);
  }

  if (
    href === "/admin/system" ||
    href === "/admin/system-settings" ||
    href === "/admin/apis" ||
    href === "/admin/seo" ||
    href === "/admin/localization" ||
    href === "/admin/content" ||
    href.startsWith("/admin/storage") ||
    href === "/admin/dropbox/uploads" ||
    href === "/admin/dropbox/settings"
  ) {
    return href === "/admin/apis" ? role === "platform_owner" : role === "platform_owner" || role === "platform_admin";
  }

  // Food library is visible to all platform roles
  if (
    href === "/admin/recipe-library" ||
    href === "/admin/ingredients" ||
    href === "/admin/units" ||
    href === "/admin/cuisines"
  ) {
    return true;
  }

  // YouTube discovery: only owner/admin
  if (href === "/admin/youtube-discovery") {
    return role === "platform_owner" || role === "platform_admin";
  }

  return true;
}

export function AdminSidebar({ session }: { session: Session }) {
  const pathname = usePathname();

  return (
    <aside className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="mb-5 rounded-2xl bg-slate-950 px-4 py-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Platform scope
        </p>
        <p className="mt-2 text-lg font-semibold">
          {session.user.platformRole === "country_manager"
            ? `${session.countryAssignments.length} assigned countries`
            : "Global administration"}
        </p>
      </div>
      <nav className="space-y-6">
        {adminNavGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {group.title}
            </p>
            {group.items
              .filter((item) => canSeeLink(session, item.href))
              .map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                      active
                        ? "bg-[var(--color-primary)]/10 font-semibold text-[var(--color-primary)]"
                        : "text-[var(--color-ink)] hover:bg-slate-50",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
