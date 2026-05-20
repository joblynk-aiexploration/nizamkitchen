import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const restaurants = await prisma.organization.findMany({
    where: { organizationType: "restaurant" },
    include: { _count: { select: { menus: true, menuItems: true, sellerFoodOrders: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminShell session={session} title="Restaurants" description="Platform owner view of restaurant organizations, menus, and order activity.">
      <AdminDataTable
        data={restaurants}
        emptyMessage="No restaurant organizations found."
        columns={[
          {
            key: "name",
            header: "Restaurant",
            render: (restaurant) => (
              <div>
                <Link href={`/admin/restaurants/${restaurant.id}`} className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]">
                  {restaurant.name}
                </Link>
                <p className="text-xs text-[var(--color-muted)]">{restaurant.countryCode}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (restaurant) => <Badge tone={restaurant.status === "active" ? "success" : "neutral"}>{restaurant.status}</Badge>,
          },
          {
            key: "menus",
            header: "Menus",
            render: (restaurant) => <span className="text-sm">{restaurant._count.menus} menus / {restaurant._count.menuItems} items</span>,
          },
          {
            key: "orders",
            header: "Orders",
            render: (restaurant) => <span className="text-sm">{restaurant._count.sellerFoodOrders}</span>,
          },
        ]}
      />
    </AdminShell>
  );
}
