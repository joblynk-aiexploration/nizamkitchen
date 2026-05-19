import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getPaymentOrder } from "@/server/payments/admin";
import { createStripeRefundAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PaymentTransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const order = await getPaymentOrder(session, id);

  return (
    <AdminShell session={session} title={`Payment order ${order.id.slice(0, 10)}`} description="Trusted payment state is derived from server-side provider events and admin-controlled gateway configuration.">
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p><p className="mt-3"><Badge tone={order.status === "paid" ? "success" : "warning"}>{order.status}</Badge></p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Amount</p><p className="mt-3 text-xl font-semibold">{order.currencyCode} {order.amount.toString()}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Platform fee</p><p className="mt-3 text-xl font-semibold">{order.platformFeeAmount?.toString() ?? "0"}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seller amount</p><p className="mt-3 text-xl font-semibold">{order.sellerAmount?.toString() ?? "0"}</p></Card>
      </section>
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Provider identifiers</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <Detail label="Provider" value={order.provider} />
          <Detail label="Gateway ID" value={order.gatewayId ?? "Not assigned"} />
          <Detail label="Provider order" value={order.providerOrderId ?? "Not set"} />
          <Detail label="Payment intent" value={order.providerPaymentIntentId ?? "Not set"} />
          <Detail label="Checkout session" value={order.providerCheckoutSessionId ?? "Not set"} />
          <Detail label="Idempotency key" value={order.idempotencyKey} />
        </dl>
      </Card>
      {session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin" ? (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="text-base font-semibold text-amber-950">Issue Stripe refund</h2>
          <p className="mt-2 text-sm text-amber-800">Refunds are processed through Stripe using the trusted provider payment intent. Only platform owner/admin can perform this action.</p>
          <form action={createStripeRefundAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <input type="hidden" name="paymentOrderId" value={order.id} />
            <label className="flex flex-col gap-2 text-sm font-medium text-amber-950">
              Amount
              <input name="amount" type="number" step="0.01" max={order.amount.toString()} required className="rounded-2xl border border-amber-200 px-4 py-3" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-amber-950">
              Reason
              <input name="reason" placeholder="requested_by_customer" className="rounded-2xl border border-amber-200 px-4 py-3" />
            </label>
            <div className="flex items-end"><button className="min-h-11 rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white">Create refund</button></div>
          </form>
        </Card>
      ) : null}
      <AdminDataTable
        data={order.transactions}
        emptyMessage="No provider transactions yet."
        columns={[
          { key: "type", header: "Type", render: (transaction) => transaction.transactionType },
          { key: "status", header: "Status", render: (transaction) => <Badge tone={transaction.status === "succeeded" ? "success" : transaction.status === "failed" ? "danger" : "warning"}>{transaction.status}</Badge> },
          { key: "amount", header: "Amount", render: (transaction) => `${transaction.currencyCode} ${transaction.amount.toString()}` },
          { key: "provider", header: "Provider ID", render: (transaction) => transaction.providerTransactionId ?? "Not set" },
        ]}
      />
    </AdminShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-[var(--color-ink)]">{label}</dt><dd className="text-[var(--color-muted)]">{value}</dd></div>;
}
