"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Building2, CalendarDays, ChefHat, CircleDollarSign, Cog, Flag, Heart, Inbox, LayoutDashboard, Logs, MapPinned, Search, Settings2, Shield, ShoppingCart, Store, Users, UtensilsCrossed } from "lucide-react";
import { getPlatformNavItems, getWorkspaceNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const iconByHref = {
  "/dashboard": LayoutDashboard,
  "/recipes": BookOpen,
  "/meal-plans": CalendarDays,
  "/grocery-lists": ShoppingCart,
  "/household": Heart,
  "/home-chef": UtensilsCrossed,
  "/chefs": Users,
  "/caterers": Store,
  "/restaurants": Store,
  "/order-instead": Search,
  "/saved-restaurants": Store,
  "/billing": CircleDollarSign,
  "/support": Inbox,
  "/admin/billing": CircleDollarSign,
  "/admin/billing/plans": CircleDollarSign,
  "/admin/billing/subscriptions": CircleDollarSign,
  "/settings": Settings2,
  "/audit-logs": Logs,
  "/chef": ChefHat,
  "/chef/profile": ChefHat,
  "/chef/verification": Shield,
  "/chef/services": ShoppingCart,
  "/chef/availability": CalendarDays,
  "/chef/requests": UtensilsCrossed,
  "/chef/reviews": Heart,
  "/catering": Store,
  "/catering/profile": Store,
  "/catering/menu": ShoppingCart,
  "/catering/menu-items": ShoppingCart,
  "/catering/orders": Inbox,
  "/catering/verification": Shield,
  "/catering/settings": Settings2,
  "/restaurant": Store,
  "/restaurant/profile": Store,
  "/restaurant/menu": ShoppingCart,
  "/restaurant/menu-items": ShoppingCart,
  "/restaurant/orders": Inbox,
  "/restaurant/verification": Shield,
  "/restaurant/settings": Settings2,
  "/orders": ShoppingCart,
  "/admin": Shield,
  "/admin/countries": MapPinned,
  "/admin/my-countries": Shield,
  "/admin/organizations": Building2,
  "/admin/users": Users,
  "/admin/feature-flags": Flag,
  "/admin/audit-logs": Logs,
  "/admin/recipe-library": BookOpen,
  "/admin/ingredients": ChefHat,
  "/admin/units": Cog,
  "/admin/cuisines": UtensilsCrossed,
  "/admin/youtube-discovery": BookOpen,
  "/admin/home-chef-requests": UtensilsCrossed,
  "/admin/chefs": ChefHat,
  "/admin/verifications": Shield,
  "/admin/verifications/requirements": Settings2,
  "/admin/home-catering": Store,
  "/admin/menu-items": ShoppingCart,
  "/admin/food-orders": Inbox,
  "/admin/restaurant-fallback": Store,
  "/admin/grocery-partners": ShoppingCart,
  "/admin/system-settings": Cog,
  "/admin/support": Users,
  "/admin/reports": BarChart3,
  "/admin/leads": Inbox,
  "/reports": BarChart3,
} as const;

export function SidebarNav({
  session,
}: {
  session: NonNullable<Awaited<ReturnType<typeof import("@/lib/auth/session").getCurrentSession>>>;
}) {
  const pathname = usePathname();
  const workspaceLinks = getWorkspaceNavItems(session);
  const platformLinks = getPlatformNavItems(session);

  return (
    <div className="flex h-full flex-col">
      <nav className="mt-8 space-y-8">
        {workspaceLinks.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace</p>
            {workspaceLinks.map((link) => {
              const Icon = iconByHref[link.href as keyof typeof iconByHref] ?? LayoutDashboard;
              const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));

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

        {platformLinks.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Platform</p>
            {platformLinks.map((link) => {
              const Icon = iconByHref[link.href as keyof typeof iconByHref] ?? Shield;
              const active = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(`${link.href}/`));

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
