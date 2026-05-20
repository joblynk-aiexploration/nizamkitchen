import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { getBillingAdminSummary } from "@/server/billing/safe-billing";

export const dynamic = "force-dynamic";

const stripeConfigured =
  Boolean(process.env.STRIPE_SECRET_KEY) &&
  process.env.STRIPE_SECRET_KEY !== "";

export default async function AdminBillingPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);

  const billingSummary = await getBillingAdminSummary();
  const { planCount, subscriptionCount, statusCounts } = billingSummary;

  return (
    <AdminShell
      session={session}
      title="Billing"
      description="Manage plans, subscriptions, and payment provider readiness."
    >
      {!stripeConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Payments are not configured yet — <code className="font-mono">STRIPE_SECRET_KEY</code> is not set.
          Subscriptions are managed manually until a payment provider is wired up.
        </div>
      )}

      {!billingSummary.ready && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {billingSummary.message ?? "Billing is not ready yet."}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active plans</p>
          <p className="mt-2 text-4xl font-bold text-[var(--color-ink)]">{planCount}</p>
          <Link href="/admin/billing/plans" className="mt-4 block text-sm font-medium text-[var(--color-primary)] hover:underline">
            Manage plans →
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total subscriptions</p>
          <p className="mt-2 text-4xl font-bold text-[var(--color-ink)]">{subscriptionCount}</p>
          <Link href="/admin/billing/subscriptions" className="mt-4 block text-sm font-medium text-[var(--color-primary)] hover:underline">
            View subscriptions →
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Provider</p>
          <p className="mt-2 text-lg font-semibold text-[var(--color-ink)]">
            {stripeConfigured ? "Stripe (configured)" : "Manual only"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {stripeConfigured
              ? "Stripe keys are present. Checkout integration not yet enabled."
              : "No payment provider configured. All subscriptions are assigned manually."}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Subscriptions by status</h2>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {(["free", "trialing", "active", "past_due", "unpaid", "cancelled"] as const).map((status) => (
            <div key={status} className="flex items-center justify-between py-2 text-sm">
              <span className="capitalize text-[var(--color-muted)]">{status.replace("_", " ")}</span>
              <span className="font-semibold text-[var(--color-ink)]">{statusCounts[status] ?? 0}</span>
            </div>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
