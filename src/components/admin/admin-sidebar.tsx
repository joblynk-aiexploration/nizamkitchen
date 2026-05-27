"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Ruler,
  Scale,
  Settings,
  Settings2,
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
      { href: "/admin/settings", label: "My Settings", icon: Settings2 },
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
      { href: "/admin/emails", label: "Email Center", icon: Mail },
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
      "/admin/settings",
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
      "/admin/settings",
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
      "/admin/settings",
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
    href === "/admin/emails" ||
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

const ADMIN_SIDEBAR_COLLAPSED_KEY = "nizamkitchen.adminSidebar.collapsed";

export function AdminSidebar({ session }: { session: Session }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === "true",
  );

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-[var(--text-primary)] transition-all duration-300",
        collapsed ? "xl:w-[88px]" : "xl:w-[260px]",
      )}
      aria-label="Admin navigation"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className={cn("mb-5 rounded-2xl bg-slate-950 text-white", collapsed ? "px-3 py-3" : "px-4 py-4")}>
        <div className={cn("flex items-start justify-between gap-3", collapsed && "justify-center")}>
          <div className={cn(collapsed && "sr-only")}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Platform scope
            </p>
            <p className="mt-2 text-lg font-semibold">
              {session.user.platformRole === "country_manager"
                ? `${session.countryAssignments.length} assigned countries`
                : "Global administration"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label={collapsed ? "Expand admin navigation" : "Collapse admin navigation"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        {collapsed ? (
          <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-300" aria-hidden="true">
            Admin
          </p>
        ) : null}
      </div>
      <nav className="space-y-6">
        {adminNavGroups.map((group) => (
          <div key={group.title} className={cn("space-y-2", collapsed && "space-y-1")}>
            <p
              className={cn(
                "px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600",
                collapsed && "sr-only",
              )}
            >
              {group.title}
            </p>
            {collapsed ? <div className="mx-auto h-px w-8 bg-slate-200" aria-hidden="true" /> : null}
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
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-[#e4f2f0] font-semibold text-[var(--color-primary-strong)] ring-1 ring-[#c6dfdb]"
                        : "text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className={cn(collapsed && "sr-only")}>{item.label}</span>
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
