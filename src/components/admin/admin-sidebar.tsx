"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ChefHat,
  CircleDollarSign,
  Flag,
  Globe2,
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
    title: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/countries", label: "Countries", icon: Globe2 },
      { href: "/admin/my-countries", label: "My countries", icon: Shield },
      { href: "/admin/organizations", label: "Organizations", icon: Building2 },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/audit-logs", label: "Audit logs", icon: Logs },
    ],
  },
  {
    title: "Food library",
    items: [
      { href: "/admin/recipe-library", label: "Recipe library", icon: BookOpen },
      { href: "/admin/youtube-discovery", label: "YouTube discovery", icon: TvMinimalPlay },
      { href: "/admin/ingredients", label: "Ingredients", icon: ChefHat },
      { href: "/admin/units", label: "Units", icon: Ruler },
      { href: "/admin/cuisines", label: "Cuisines", icon: UtensilsCrossed },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/admin/meal-planner", label: "Meal planner", icon: CalendarDays },
      { href: "/admin/home-chef-requests", label: "Home chef requests", icon: UtensilsCrossed },
      { href: "/admin/chefs", label: "Chef marketplace", icon: ChefHat },
      { href: "/admin/chef-verifications", label: "Chef verifications", icon: Shield },
      { href: "/admin/restaurant-fallback", label: "Restaurant fallback", icon: ShoppingCart },
    ],
  },
  {
    title: "Grocery Engine",
    items: [
      { href: "/admin/grocery-engine", label: "Overview", icon: ShoppingCart },
      { href: "/admin/grocery-partners", label: "Partners", icon: Building2 },
      { href: "/admin/grocery-engine/conversions", label: "Conversions", icon: Scale },
      { href: "/admin/grocery-engine/warnings", label: "Warnings", icon: AlertTriangle },
    ],
  },
  {
    title: "Analytics",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/leads", label: "Contact leads", icon: Inbox },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/admin/feature-flags", label: "Feature flags", icon: Flag },
      { href: "/admin/system", label: "System status", icon: ServerCog },
      { href: "/admin/system-settings", label: "System settings", icon: Settings },
      { href: "/admin/billing", label: "Billing", icon: CircleDollarSign },
      { href: "/admin/support", label: "Support", icon: UserRoundSearch },
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
      "/admin/restaurant-fallback",
      "/admin/grocery-partners",
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
      "/admin/support",
      "/admin/leads",
    ].includes(href);
  }

  if (role === "auditor") {
    return [
      "/admin",
      "/admin/organizations",
      "/admin/users",
      "/admin/audit-logs",
    ].includes(href);
  }

  if (href === "/admin/system" || href === "/admin/system-settings") {
    return role === "platform_owner" || role === "platform_admin";
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
