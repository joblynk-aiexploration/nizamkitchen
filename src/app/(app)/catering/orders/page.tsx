import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listSellerFoodOrders } from "@/server/food-orders";

export const dynamic = "force-dynamic";

export default async function CateringOrdersPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") {
    return <EmptyState title="Home catering only" description="Seller order requests are available to home catering organizations." />;
  }
  const orders = await listSellerFoodOrders(session.activeOrganization.id);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Home catering" title="Order requests" description="Review manual food order requests from households. No checkout or payment processing is connected." />
      {orders.length === 0 ? <EmptyState title="No orders yet" description="Published menu items will let households submit order inquiries here." /> : null}
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
              <Button asChild variant="secondary"><Link href={`/catering/orders/${order.id}`}>Manage</Link></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
