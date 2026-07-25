"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ChefHat,
  ChevronDown,
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
  ShieldCheck,
  ServerCog,
  ShoppingCart,
  Store,
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
    icon: Shield,
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
    icon: Settings,
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
    icon: UtensilsCrossed,
    items: [
      { href: "/admin/recipe-library", label: "Recipe library", icon: BookOpen },
      { href: "/admin/ingredients", label: "Ingredients", icon: ChefHat },
      { href: "/admin/ingredient-requests", label: "Ingredient requests", icon: Inbox },
      { href: "/admin/units", label: "Units", icon: Ruler },
      { href: "/admin/cuisines", label: "Cuisines", icon: UtensilsCrossed },
      { href: "/admin/templates", label: "Dish/Menu Templates", icon: BookOpen },
      { href: "/admin/youtube-discovery", label: "YouTube discovery", icon: TvMinimalPlay },
    ],
  },
  {
    title: "Marketplace",
    icon: Store,
    items: [
      { href: "/admin/home-chef-requests", label: "Home chef requests", icon: UtensilsCrossed },
      { href: "/admin/home-chef-acceptance-policies", label: "Home chef policies", icon: ShieldCheck },
      { href: "/admin/home-chef/privacy-policies", label: "Home chef privacy", icon: ShieldCheck },
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
    icon: ServerCog,
    items: [
      { href: "/admin/payments", label: "Payments", icon: CircleDollarSign },
      { href: "/admin/billing", label: "Billing", icon: CircleDollarSign },
      { href: "/admin/pricing", label: "Pricing Center", icon: CircleDollarSign },
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
    icon: Globe2,
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
      "/admin/home-chef-acceptance-policies",
      "/admin/home-chef/privacy-policies",
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
      "/admin/home-chef-acceptance-policies",
      "/admin/home-chef/privacy-policies",
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
    href === "/admin/ingredient-requests" ||
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
const ADMIN_SIDEBAR_GROUPS_KEY = "nizamkitchen.adminSidebar.openGroups";

export function AdminSidebar({ session }: { session: Session }) {
  const pathname = usePathname();
  const visibleGroups = adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSeeLink(session, item.href)),
    }))
    .filter((group) => group.items.length > 0);
  const activeGroupTitle =
    visibleGroups.find((group) => group.items.some((item) => isAdminNavItemActive(pathname, item.href)))?.title ??
    visibleGroups[0]?.title;
  const visibleGroupTitles = visibleGroups.map((group) => group.title);
  const visibleGroupKey = visibleGroupTitles.join("|");
  const defaultGroups = defaultOpenGroups(visibleGroupTitles, activeGroupTitle);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(defaultGroups);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const visibleTitles = visibleGroupKey.split("|").filter(Boolean);
      const defaultOpenState = defaultOpenGroups(visibleTitles, activeGroupTitle);
      setCollapsed(window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === "true");

      const stored = window.localStorage.getItem(ADMIN_SIDEBAR_GROUPS_KEY);
      if (!stored) {
        setOpenGroups(defaultOpenState);
        return;
      }

      try {
        setOpenGroups({
          ...defaultOpenState,
          ...JSON.parse(stored),
        });
      } catch {
        setOpenGroups(defaultOpenState);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeGroupTitle, visibleGroupKey]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  function openSidebarToGroup(title: string) {
    setCollapsed(false);
    window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, "false");
    setOpenGroups((current) => {
      const next = { ...current, [title]: true };
      window.localStorage.setItem(ADMIN_SIDEBAR_GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleGroup(title: string) {
    if (collapsed) {
      openSidebarToGroup(title);
      return;
    }

    setOpenGroups((current) => {
      const next = { ...current, [title]: !current[title] };
      window.localStorage.setItem(ADMIN_SIDEBAR_GROUPS_KEY, JSON.stringify(next));
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
      <nav className="space-y-3">
        {visibleGroups.map((group) => {
          const GroupIcon = group.icon;
          const groupActive = group.items.some((item) => isAdminNavItemActive(pathname, item.href));
          const open = Boolean(openGroups[group.title]) || groupActive;

          return (
            <section key={group.title} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                aria-expanded={!collapsed && open}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition",
                  collapsed && "justify-center px-0",
                  groupActive
                    ? "bg-[#e4f2f0] text-[var(--color-primary-strong)] ring-1 ring-[#c6dfdb]"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-[var(--text-primary)]",
                )}
                title={collapsed ? group.title : undefined}
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className={cn("min-w-0 flex-1 truncate text-left", collapsed && "sr-only")}>
                  {group.title}
                </span>
                <span className={cn("rounded-full bg-white px-2 py-0.5 text-[0.68rem] text-slate-500 ring-1 ring-slate-200", collapsed && "sr-only")}>
                  {group.items.length}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                    open && "rotate-180",
                    collapsed && "sr-only",
                  )}
                  aria-hidden="true"
                />
              </button>

              {!collapsed && open ? (
                <div className="space-y-1 pl-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isAdminNavItemActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                          active
                            ? "bg-[#e4f2f0] font-semibold text-[var(--color-primary-strong)] ring-1 ring-[#c6dfdb]"
                            : "text-[var(--text-secondary)] hover:bg-slate-100 hover:text-[var(--text-primary)]",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}

function defaultOpenGroups(groupTitles: string[], activeGroupTitle?: string) {
  return Object.fromEntries(groupTitles.map((title) => [title, title === activeGroupTitle]));
}

function isAdminNavItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}
