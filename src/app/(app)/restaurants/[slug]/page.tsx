import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { listPublicMenuItemsForOrganization } from "@/server/menus";

export const dynamic = "force-dynamic";

export default async function RestaurantProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireMembership();
  const enabled = await isFeatureEnabled("restaurant_profiles", session.activeOrganization.id);
  if (!enabled) notFound();
  const { slug } = await params;
  const restaurant = await prisma.organization.findFirst({
    where: { slug, organizationType: "restaurant", status: "active" },
    select: { id: true, name: true, countryCode: true },
  });
  if (!restaurant) notFound();
  const menuItems = await listPublicMenuItemsForOrganization(restaurant.id);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant partner" title={restaurant.name} description="Browse menu items and submit manual order requests. Payment is handled directly with the restaurant for now." />
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Menu</h2>
        {menuItems.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted)]">No active public menu items have been published yet.</p> : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {menuItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{item.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{item.category.replace(/_/g, " ")}</p>
                </div>
                <Badge tone={item.status === "sold_out" ? "warning" : "success"}>{item.status === "sold_out" ? "Sold out" : "Available"}</Badge>
              </div>
              {item.description ? <p className="mt-3 text-sm text-[var(--color-muted)]">{item.description}</p> : null}
              <div className="mt-4 flex items-center justify-between">
                <p className="font-semibold">{item.priceAmount ? `${item.currencyCode} ${item.priceAmount}` : "Price TBD"}</p>
                {item.status === "active" ? (
                  <Button variant="secondary" asChild><Link href={`/orders/new?menuItemId=${item.id}`}>Request order</Link></Button>
                ) : (
                  <Button variant="secondary" disabled>Sold out</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
