import Link from "next/link";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { getPaymentOperationsDashboard } from "@/server/payments/operations";

export const dynamic = "force-dynamic";

export default async function PaymentOperationsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const dashboard = await getPaymentOperationsDashboard(session, {
    countryCode: params.countryCode,
    provider: params.provider,
    module: params.module,
    status: params.status,
    sellerOrganizationId: params.sellerOrganizationId,
    customerOrganizationId: params.customerOrganizationId,
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(params.to) : undefined,
  });

  return (
    <AdminShell session={session} title="Payment operations" description="Monitor gross volume, refunds, disputes, commissions, payouts, and high-risk events across providers.">
      <Card>
        <form className="grid gap-4 md:grid-cols-4">
          <TextInput label="From" name="from" type="date" defaultValue={params.from ?? ""} />
          <TextInput label="To" name="to" type="date" defaultValue={params.to ?? ""} />
          <TextInput label="Country" name="countryCode" defaultValue={params.countryCode ?? ""} maxLength={2} />
          <SelectInput label="Provider" name="provider" defaultValue={params.provider ?? ""} options={[{ value: "", label: "All" }, { value: "stripe", label: "Stripe" }, { value: "paypal", label: "PayPal" }, { value: "manual", label: "Manual" }, { value: "cash", label: "Cash" }]} />
          <TextInput label="Module" name="module" defaultValue={params.module ?? ""} placeholder="food_order" />
          <TextInput label="Status" name="status" defaultValue={params.status ?? ""} placeholder="paid" />
          <TextInput label="Seller org" name="sellerOrganizationId" defaultValue={params.sellerOrganizationId ?? ""} />
          <TextInput label="Customer org" name="customerOrganizationId" defaultValue={params.customerOrganizationId ?? ""} />
          <div className="md:col-span-4 flex gap-3">
            <Button type="submit">Apply filters</Button>
            <Button asChild variant="secondary"><Link href="/api/admin/payments/export?type=transactions">Export transactions CSV</Link></Button>
            <Button asChild variant="secondary"><Link href="/api/admin/payments/export?type=commissions">Export commissions CSV</Link></Button>
          </div>
        </form>
      </Card>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Gross volume" value={dashboard.grossVolume} />
        <Metric label="Platform fees" value={dashboard.netPlatformFees} />
        <Metric label="Seller amounts" value={dashboard.sellerAmounts} />
        <Metric label="Refunds" value={dashboard.refundsTotal} />
        <Metric label="Failed payments" value={dashboard.failedPayments} />
        <Metric label="Disputes" value={dashboard.disputesCount} />
        <Metric label="Pending payouts" value={dashboard.pendingPayouts} />
        <Metric label="Failed events" value={dashboard.failedEvents.length} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="Provider breakdown" data={dashboard.providerBreakdown} />
        <Breakdown title="Country breakdown" data={dashboard.countryBreakdown} />
        <Breakdown title="Module breakdown" data={dashboard.moduleBreakdown} />
      </section>

      <AdminDataTable
        data={dashboard.recentOrders}
        emptyMessage="No payment orders match the filters."
        columns={[
          { key: "order", header: "Order", render: (order) => <Link className="font-semibold text-[var(--color-primary)]" href={`/admin/payments/transactions/${order.id}`}>{order.id.slice(0, 10)}</Link> },
          { key: "module", header: "Module", render: (order) => order.module },
          { key: "provider", header: "Provider", render: (order) => order.provider },
          { key: "status", header: "Status", render: (order) => <Badge tone={order.status === "paid" ? "success" : order.status === "failed" ? "danger" : "warning"}>{order.status}</Badge> },
          { key: "amount", header: "Amount", render: (order) => `${order.currencyCode} ${order.amount.toString()}` },
        ]}
      />
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold">{value.toFixed(2)}</p></Card>;
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  return <Card><h2 className="font-semibold text-[var(--color-ink)]">{title}</h2><div className="mt-4 space-y-2 text-sm">{Object.entries(data).map(([key, value]) => <div key={key} className="flex justify-between"><span>{key}</span><strong>{value}</strong></div>)}</div></Card>;
}
