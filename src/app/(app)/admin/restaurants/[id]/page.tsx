import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const restaurant = await prisma.organization.findFirst({
    where: { id, organizationType: "restaurant" },
    include: {
      memberships: { include: { user: true } },
      menus: { include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" } },
      sellerFoodOrders: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });

  return (
    <AdminShell session={session} title={restaurant?.name ?? "Restaurant"} description="Restaurant organization detail and related operational records.">
      {!restaurant ? (
        <Card><p className="text-sm text-[var(--color-muted)]">Restaurant not found.</p></Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--color-ink)]">{restaurant.name}</h2>
                <p className="text-sm text-[var(--color-muted)]">{restaurant.countryCode} · {restaurant.currencyCode}</p>
              </div>
              <Badge tone={restaurant.status === "active" ? "success" : "neutral"}>{restaurant.status}</Badge>
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Menus</h2>
            <div className="mt-4 divide-y divide-[var(--color-border)]">
              {restaurant.menus.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No menus yet.</p>
              ) : (
                restaurant.menus.map((menu) => (
                  <div key={menu.id} className="flex items-center justify-between py-3 text-sm">
                    <span>{menu.name}</span>
                    <span className="text-[var(--color-muted)]">{menu._count.items} items</span>
                  </div>
                ))
              )}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Members</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {restaurant.memberships.map((membership) => (
                <Link key={membership.id} href={`/admin/users/${membership.userId}`} className="rounded-2xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)]">
                  <p className="font-medium text-[var(--color-ink)]">{membership.user.fullName}</p>
                  <p className="text-xs text-[var(--color-muted)]">{membership.role}</p>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}
    </AdminShell>
  );
}
