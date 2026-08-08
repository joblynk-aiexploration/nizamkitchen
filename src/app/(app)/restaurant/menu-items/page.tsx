import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessMenus, listMenuItemsForOrganization } from "@/server/menus";
import { getSellerUsage, isMetricAtLimit } from "@/server/billing/seller-usage";
import { UpgradeModal } from "@/components/commerce/upgrade-modal";

export const dynamic = "force-dynamic";

export default async function RestaurantMenuItemsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const [session, query] = await Promise.all([requireMembership(), searchParams]);
  if (session.activeOrganization.organizationType !== "restaurant") return <EmptyState title="Restaurant only" description="Menu items are available for restaurant organizations." />;
  const enabled = await canAccessMenus({ organizationId: session.activeOrganization.id, organizationType: "restaurant", platformRole: session.user.platformRole });
  if (!enabled) return <EmptyState title="Restaurant profiles coming soon" description="Restaurant menu item management is not enabled yet." />;

  const [items, usage] = await Promise.all([
    listMenuItemsForOrganization(session.activeOrganization.id),
    getSellerUsage(session.activeOrganization.id),
  ]);

  const menuItemMetric = usage.metrics.find((m) => m.key === "menuItems");
  const atMenuItemLimit = menuItemMetric ? isMetricAtLimit(menuItemMetric) : false;

  const createAction = atMenuItemLimit ? (
    <UpgradeModal
      trigger={<Button variant="warning">Upgrade plan</Button>}
      currentPlanName={usage.entitlement.planName}
      limitLabel="Menu Items"
      current={menuItemMetric?.current ?? 0}
      limit={menuItemMetric?.limit ?? 0}
      upgradePlans={usage.upgradePlans}
    />
  ) : (
    <Button asChild><Link href="/restaurant/menu-items/new">Add menu item</Link></Button>
  );

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant" title="Menu items" description="Manage the dishes households can browse and order." actions={createAction} />
      <FormMessage message={query.message} />
      {items.length === 0 ? <EmptyState title="No menu items yet" description="Add your first restaurant dish." /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link key={item.id} href={`/restaurant/menu-items/${item.id}`}>
              <Card className="h-full">
                <div className="flex justify-between gap-3"><h2 className="font-semibold">{item.name}</h2><Badge tone={item.status === "active" ? "success" : "warning"}>{item.status}</Badge></div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{item.menu?.name ?? "No menu"} · {item.category}</p>
                <p className="mt-4 font-semibold">{item.priceAmount ? `${item.currencyCode} ${item.priceAmount}` : "Price not set"}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
