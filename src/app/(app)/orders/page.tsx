import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listCustomerFoodOrders } from "@/server/food-orders";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "household") {
    return <EmptyState title="Household orders only" description="Food order requests are available from household organizations." />;
  }
  const orders = await listCustomerFoodOrders(session.activeOrganization.id);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Orders" title="Food order requests" description="Track manual order requests sent to home catering sellers and restaurant partners." />
      {orders.length === 0 ? <EmptyState title="No order requests yet" description="Browse caterers or restaurant menus and submit a request when you find something you like." /> : null}
      <div className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-[var(--color-ink)]">{order.sellerOrganization.name}</h2>
                  <Badge tone={order.status === "cancelled" || order.status === "declined" ? "danger" : order.status === "completed" ? "success" : "info"}>{order.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  {order.items.map((item) => `${item.quantity} x ${item.nameSnapshot}`).join(", ")}
                </p>
                <p className="mt-1 text-sm font-semibold">{order.subtotalAmount ? `${order.currencyCode} ${order.subtotalAmount}` : "Price to be confirmed"}</p>
              </div>
              <Button asChild variant="secondary"><Link href={`/orders/${order.id}`}>View order</Link></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
