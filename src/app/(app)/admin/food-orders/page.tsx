import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminFoodOrders } from "@/server/food-orders";

export const dynamic = "force-dynamic";

export default async function AdminFoodOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ countryCode?: string; status?: string; sellerType?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const orders = await listAdminFoodOrders(session, params);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Food orders" description="Manual order requests across home catering sellers and restaurant partners." />
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr>
                <th className="py-3 pr-4">Order</th>
                <th className="py-3 pr-4">Customer</th>
                <th className="py-3 pr-4">Seller</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Created</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-[var(--color-border)]">
                  <td className="py-4 pr-4 font-semibold">{order.id.slice(-6).toUpperCase()}</td>
                  <td className="py-4 pr-4">{order.customerOrganization.name}</td>
                  <td className="py-4 pr-4">{order.sellerOrganization.name}</td>
                  <td className="py-4 pr-4">{order.sellerType.replace(/_/g, " ")}</td>
                  <td className="py-4 pr-4"><Badge tone="info">{order.status.replace(/_/g, " ")}</Badge></td>
                  <td className="py-4 pr-4">{order.createdAt.toLocaleDateString()}</td>
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
