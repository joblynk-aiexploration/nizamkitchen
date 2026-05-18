"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, CalendarDays, ChefHat, Cog, CreditCard, Flag, Heart, KeyRound, LayoutDashboard, Logs, MapPinned, Settings2, Shield, ShoppingCart, Users, UtensilsCrossed } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const appLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/ingredients", label: "Ingredients", icon: ChefHat },
  { href: "/meal-plans", label: "Meal Plans", icon: CalendarDays },
  { href: "/grocery-lists", label: "Grocery Lists", icon: ShoppingCart },
  { href: "/household", label: "Household", icon: Heart },
  { href: "/home-chef", label: "Home Chef", icon: UtensilsCrossed },
  { href: "/chefs", label: "Browse Chefs", icon: Users },
  { href: "/chef/requests", label: "Chef Requests", icon: ChefHat },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings2 },
  { href: "/audit-logs", label: "Audit Logs", icon: Logs, permission: "audit:view" as const },
  { href: "/billing", label: "Billing", icon: CreditCard, permission: "billing:view" as const },
  { href: "/developer", label: "Developer", icon: KeyRound, permission: "developer:view" as const },
];

const adminLinks = [
  { href: "/admin", label: "Admin Overview", icon: Shield },
  { href: "/admin/countries", label: "Countries", icon: MapPinned },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/audit-logs", label: "Audit Trail", icon: Logs },
  { href: "/admin/feature-flags", label: "Feature Flags", icon: Flag },
  { href: "/admin/meal-planner", label: "Meal Planner", icon: CalendarDays },
  { href: "/admin/home-chef-requests", label: "Home Chef Requests", icon: UtensilsCrossed },
  { href: "/admin/chefs", label: "Chef Marketplace", icon: ChefHat },
  { href: "/admin/system-settings", label: "System Settings", icon: Cog },
];

export function SidebarNav({
  session,
}: {
  session: NonNullable<Awaited<ReturnType<typeof import("@/lib/auth/session").getCurrentSession>>>;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <nav className="mt-8 space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
          {appLinks
            .filter((link) =>
              link.permission
                ? hasPermission({
                    platformRole: session.user.platformRole,
                    membershipRole: session.activeMembership?.role,
                    permission: link.permission,
                  })
                : true,
            )
            .map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    active
                      ? "bg-white/12 text-white"
                      : "text-slate-300 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
        </div>

        {hasPermission({
          platformRole: session.user.platformRole,
          membershipRole: session.activeMembership?.role,
          permission: "admin:access",
        }) ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Platform</p>
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition",
                    active
                      ? "bg-white/12 text-white"
                      : "text-slate-300 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
