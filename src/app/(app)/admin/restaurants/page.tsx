import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { getPaginationInput, getPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const paginationInput = getPaginationInput({ page: params.page });
  const where = { organizationType: "restaurant" as const };
  const [totalRestaurants, restaurants] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      include: { _count: { select: { menus: true, menuItems: true, sellerFoodOrders: true } } },
      orderBy: { createdAt: "desc" },
      skip: paginationInput.skip,
      take: paginationInput.take,
    }),
  ]);

  return (
    <AdminShell session={session} title="Restaurants" description="Platform owner view of restaurant organizations, menus, and order activity.">
      <AdminDataTable
        data={restaurants}
        emptyMessage="No restaurant organizations found."
        pagination={getPaginationMeta(totalRestaurants, paginationInput)}
        paginationBasePath="/admin/restaurants"
        paginationSearchParams={params}
        paginationItemLabel="restaurants"
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
