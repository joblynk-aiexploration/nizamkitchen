import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getPaymentsOverview, listPaymentOrdersPage } from "@/server/payments/admin";

export const dynamic = "force-dynamic";

export default async function PaymentTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const [overview, orders] = await Promise.all([
    getPaymentsOverview(session),
    listPaymentOrdersPage(session, { page: params.page }),
  ]);

  return (
    <AdminShell session={session} title="Payment transactions" description="Review normalized payment orders and provider transaction records. Customers cannot mark payments paid from the client.">
      <section className="grid gap-4 md:grid-cols-3">
        <Card><Metric label="Payment orders" value={overview.orders} /></Card>
        <Card><Metric label="Provider transactions" value={overview.transactions} /></Card>
        <Card><Metric label="Refunds" value={overview.refunds} /></Card>
      </section>
      <AdminDataTable
        data={orders.items}
        emptyMessage="No payment orders yet."
        pagination={orders.pagination}
        paginationBasePath="/admin/payments/transactions"
        paginationSearchParams={params}
        paginationItemLabel="payment orders"
        columns={[
          { key: "id", header: "Order", render: (order) => <Link href={`/admin/payments/transactions/${order.id}`} className="font-semibold text-[var(--color-primary)]">{order.id.slice(0, 10)}</Link> },
          { key: "module", header: "Module", render: (order) => order.module.replace(/_/g, " ") },
          { key: "provider", header: "Provider", render: (order) => order.provider },
          { key: "status", header: "Status", render: (order) => <Badge tone={order.status === "paid" ? "success" : order.status === "failed" ? "danger" : "warning"}>{order.status}</Badge> },
          { key: "amount", header: "Amount", render: (order) => `${order.currencyCode} ${order.amount}` },
          { key: "country", header: "Country", render: (order) => order.countryCode },
        ]}
      />
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></>;
}
