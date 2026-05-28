import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listSellerFoodOrders } from "@/server/food-orders";

export const dynamic = "force-dynamic";

export default async function RestaurantOrdersPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Restaurant order requests are available to restaurant organizations." />;
  }
  const orders = await listSellerFoodOrders(session.activeOrganization.id);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant" title="Order requests" description="Manage manual order requests from households. This is not live checkout." />
      {orders.length === 0 ? <EmptyState title="No orders yet" description="Active public menu items can receive household order inquiries." /> : null}
      <div className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <h2 className="font-semibold text-[var(--color-ink)]">{order.customerOrganization.name}</h2>
                  <Badge tone="info">{order.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{order.items.map((item) => `${item.quantity} x ${item.nameSnapshot}`).join(", ")}</p>
              </div>
              <Button asChild variant="secondary"><Link href={`/restaurant/orders/${order.id}`}>Manage</Link></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
