import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RestaurantsPage() {
  const session = await requireMembership();
  const enabled = await isFeatureEnabled("restaurant_profiles", session.activeOrganization.id);
  if (!enabled) return <EmptyState title="Restaurant profiles coming soon" description="Restaurant profile browsing is not enabled yet." />;

  const restaurants = await prisma.organization.findMany({
    where: {
      organizationType: "restaurant",
      status: "active",
      menuItems: { some: { status: { in: ["active", "sold_out"] }, menu: { status: "active", visibility: "public" } } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      countryCode: true,
      _count: { select: { menuItems: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurants" title="Browse restaurant menus" description="View restaurant partner menu foundations before live ordering is connected." />
      {restaurants.length === 0 ? <EmptyState title="No restaurant menus yet" description="Approved restaurant menus will appear here." /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {restaurants.map((restaurant) => (
            <Link key={restaurant.id} href={`/restaurants/${restaurant.slug}`}>
              <Card className="h-full">
                <h2 className="text-xl font-semibold">{restaurant.name}</h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{restaurant.countryCode} · {restaurant._count.menuItems} menu items</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
