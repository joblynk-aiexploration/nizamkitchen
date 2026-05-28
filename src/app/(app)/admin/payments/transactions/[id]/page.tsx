import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatAppDateTime } from "@/lib/utils";
import { getPaymentOrder } from "@/server/payments/admin";
import Link from "next/link";
import type { ReactNode } from "react";
import { createProviderRefundAction, markManualPaymentAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PaymentTransactionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const order = await getPaymentOrder(session, id);
  const [webhooks, purchaser, organizations] = await Promise.all([
    prisma.paymentWebhookEvent.findMany({
      where: { provider: order.provider, ...(order.gatewayId ? { gatewayId: order.gatewayId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    order.customerUserId
      ? prisma.user.findUnique({
          where: { id: order.customerUserId },
          select: { id: true, fullName: true, email: true, phone: true },
        })
      : null,
    prisma.organization.findMany({
      where: {
        id: {
          in: [order.customerOrganizationId, order.sellerOrganizationId, order.organizationId].filter(Boolean) as string[],
        },
      },
      select: { id: true, name: true, organizationType: true, countryCode: true },
    }),
  ]);
  const moduleLink = moduleHref(order.module, order.moduleEntityId);
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const customerOrganization = order.customerOrganizationId ? organizationById.get(order.customerOrganizationId) : null;
  const sellerOrganization = order.sellerOrganizationId ? organizationById.get(order.sellerOrganizationId) : null;
  const platformOrganization = organizationById.get(order.organizationId);
  const purchaseTime = order.paidAt ?? order.createdAt;

  return (
    <AdminShell session={session} title={`Payment order ${order.id.slice(0, 10)}`} description="Trusted payment state is derived from server-side provider events and admin-controlled gateway configuration.">
      <FormMessage message={query.message} />
      <Card className="overflow-hidden border-teal-100 bg-[linear-gradient(135deg,#f8fffd,#eef7ff)] p-0">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Purchaser</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-800 text-xl font-black text-white shadow-lg shadow-teal-900/20">
                {initials(purchaser?.fullName ?? customerOrganization?.name ?? "Customer")}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-ink)]">{purchaser?.fullName ?? customerOrganization?.name ?? "Customer not linked"}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{purchaser?.email ?? "No customer email on this payment order"}</p>
                {purchaser?.phone ? <p className="mt-1 text-sm text-[var(--color-muted)]">{purchaser.phone}</p> : null}
              </div>
            </div>
            <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
              <Detail label="Customer organization" value={customerOrganization ? `${customerOrganization.name} (${customerOrganization.organizationType})` : order.customerOrganizationId ?? "Not linked"} />
              <Detail label="Seller organization" value={sellerOrganization ? `${sellerOrganization.name} (${sellerOrganization.organizationType})` : order.sellerOrganizationId ?? "Not applicable"} />
              <Detail label="Platform organization" value={platformOrganization?.name ?? order.organizationId} />
              <Detail label="Customer user ID" value={order.customerUserId ?? "Not linked"} />
            </dl>
          </div>
          <div className="border-t border-teal-100 bg-white/70 p-6 lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Purchase timeline</p>
            <div className="mt-4 rounded-3xl bg-slate-950 p-5 text-white">
              <p className="text-sm text-slate-300">{order.paidAt ? "Purchased at" : "Created at"}</p>
              <p className="mt-2 text-2xl font-black">{formatAppDateTime(purchaseTime, { showTimeZone: true })}</p>
              <p className="mt-3 text-sm text-slate-300">Displayed in Central time for Platform Owner review.</p>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <Detail label="Checkout created" value={formatAppDateTime(order.createdAt, { showTimeZone: true })} />
              <Detail label="Payment confirmed" value={order.paidAt ? formatAppDateTime(order.paidAt, { showTimeZone: true }) : "Not paid yet"} />
            </div>
          </div>
        </div>
      </Card>
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
          <Detail label="Purchased" value={formatAppDateTime(purchaseTime, { showTimeZone: true })} />
        </dl>
      </Card>
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Payment context</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <Detail label="Module" value={order.module} />
          <div>
            <dt className="font-semibold text-[var(--color-ink)]">Module entity</dt>
            <dd>{moduleLink ? <Link className="text-[var(--color-primary)]" href={moduleLink}>{order.moduleEntityId}</Link> : <span className="text-[var(--color-muted)]">{order.moduleEntityId}</span>}</dd>
          </div>
          <Detail label="Customer" value={purchaser ? `${purchaser.fullName} · ${purchaser.email}` : "No user linked"} />
          <Detail label="Customer org" value={customerOrganization?.name ?? order.customerOrganizationId ?? "Not set"} />
          <Detail label="Seller org" value={sellerOrganization?.name ?? order.sellerOrganizationId ?? "Not set"} />
          <Detail label="Tax" value={order.taxAmount?.toString() ?? "0"} />
          <Detail label="Created" value={formatAppDateTime(order.createdAt, { showTimeZone: true })} />
        </dl>
      </Card>
      {(session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin") && (order.status === "paid" || order.status === "partially_refunded") && (order.provider === "stripe" || order.provider === "paypal") ? (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="text-base font-semibold text-amber-950">Issue refund</h2>
          <p className="mt-2 text-sm text-amber-800">Refunds validate remaining paid amount server-side before calling the configured provider. Only platform owner/admin can perform this action.</p>
          <form action={createProviderRefundAction} className="mt-4 grid gap-4 md:grid-cols-3">
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
      {(session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin") && (order.provider === "manual" || order.provider === "cash") ? (
        <Card className="border-slate-200 bg-slate-50">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Manual reconciliation</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Manual payment is not verified by NizamKitchen. Use only for cash, bank transfer, or direct seller payment records.</p>
          <form action={markManualPaymentAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <input type="hidden" name="paymentOrderId" value={order.id} />
            <select name="status" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
              <option value="paid">Mark paid</option>
              <option value="failed">Mark failed</option>
            </select>
            <input name="note" placeholder="Internal note" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm" />
            <button className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save manual status</button>
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
          { key: "created", header: "Created", render: (transaction) => formatAppDateTime(transaction.createdAt, { showTimeZone: true }) },
        ]}
      />
      <AdminDataTable
        data={order.refunds}
        emptyMessage="No refunds yet."
        columns={[
          { key: "status", header: "Status", render: (refund) => <Badge tone={refund.status === "succeeded" ? "success" : refund.status === "failed" ? "danger" : "warning"}>{refund.status}</Badge> },
          { key: "amount", header: "Amount", render: (refund) => `${refund.currencyCode} ${refund.amount.toString()}` },
          { key: "reason", header: "Reason", render: (refund) => refund.reason ?? "Not provided" },
          { key: "created", header: "Created", render: (refund) => formatAppDateTime(refund.createdAt, { showTimeZone: true }) },
        ]}
      />
      <AdminDataTable
        data={order.disputes}
        emptyMessage="No disputes linked to this order."
        columns={[
          { key: "provider", header: "Provider", render: (dispute) => dispute.provider },
          { key: "status", header: "Status", render: (dispute) => <Badge tone={dispute.status === "lost" ? "danger" : dispute.status === "won" ? "success" : "warning"}>{dispute.status}</Badge> },
          { key: "amount", header: "Amount", render: (dispute) => dispute.amount ? `${dispute.currencyCode} ${dispute.amount.toString()}` : "Not provided" },
          { key: "reason", header: "Reason", render: (dispute) => dispute.reason ?? "Not provided" },
        ]}
      />
      <AdminDataTable
        data={webhooks}
        emptyMessage="No recent webhook events for this gateway."
        columns={[
          { key: "event", header: "Event", render: (event) => event.eventType },
          { key: "status", header: "Status", render: (event) => <Badge tone={event.status === "processed" ? "success" : event.status === "failed" ? "danger" : "warning"}>{event.status}</Badge> },
          { key: "signature", header: "Signature", render: (event) => event.signatureValid ? "valid" : "not verified" },
          { key: "created", header: "Created", render: (event) => formatAppDateTime(event.createdAt, { showTimeZone: true }) },
        ]}
      />
    </AdminShell>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt className="font-semibold text-[var(--color-ink)]">{label}</dt><dd className="text-[var(--color-muted)]">{value}</dd></div>;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase())
    .join("") || "CU";
}

function moduleHref(module: string, entityId: string) {
  if (module === "food_order" || module === "catering_order" || module === "restaurant_order") return `/admin/food-orders/${entityId}`;
  if (module === "home_chef_request" || module === "chef_booking") return `/admin/home-chef-requests/${entityId}`;
  if (module === "subscription") return `/admin/billing/subscriptions`;
  return null;
}
