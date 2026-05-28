import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminFulfillmentOrders } from "@/server/fulfillment/fulfillment-service";

export const dynamic = "force-dynamic";

export default async function AdminFulfillmentOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string; status?: string; fulfillmentType?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const orders = await listAdminFulfillmentOrders(session, params);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Fulfillment orders" description="Track pickup, delivery, preorder, scheduling, and handoff status for food orders." />
      {orders.length === 0 ? <EmptyState title="No fulfillment orders" description="Food orders will appear here when households submit pickup, delivery, or preorder requests." /> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr>
                <th className="py-3 pr-4">Order</th>
                <th className="py-3 pr-4">Seller</th>
                <th className="py-3 pr-4">Customer</th>
                <th className="py-3 pr-4">Fulfillment</th>
                <th className="py-3 pr-4">Schedule</th>
                <th className="py-3 pr-4">Fee/zone</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-[var(--color-border)]">
                  <td className="py-4 pr-4 font-semibold">{order.id.slice(-6).toUpperCase()} <Badge tone="info">{order.status.replace(/_/g, " ")}</Badge></td>
                  <td className="py-4 pr-4">{order.sellerOrganization.name}</td>
                  <td className="py-4 pr-4">{order.customerOrganization.name}</td>
                  <td className="py-4 pr-4">{order.fulfillmentType.replace(/_/g, " ")} · {order.fulfillmentStatus.replace(/_/g, " ")}</td>
                  <td className="py-4 pr-4">{order.requestedDate ? order.requestedDate.toLocaleDateString() : "Not set"} {order.requestedTimeWindow ?? ""}</td>
                  <td className="py-4 pr-4">{order.deliveryZone?.name ?? order.pickupLocation?.label ?? "Not matched"} · {order.deliveryFeeAmount ?? 0}</td>
                  <td className="py-4"><Button asChild variant="secondary"><Link href={`/admin/food-orders/${order.id}`}>Open</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
