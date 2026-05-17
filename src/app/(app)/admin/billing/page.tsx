import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);
  const subscriptions = await prisma.billingSubscription.findMany({
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminShell
      session={session}
      title="Billing placeholder"
      description="Review plan placeholders, trial states, billing countries, and invoice/provider readiness before payment integration is added."
    >
      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Plans</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">Starter, Growth, and Enterprise placeholders are ready for a future payment provider.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Invoices</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">Invoice storage is intentionally a placeholder until provider integration is selected.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Provider</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">Stripe is not integrated in this phase. Provider choice remains open.</p>
        </Card>
      </section>

      <AdminDataTable
        data={subscriptions}
        emptyMessage="No subscription placeholder rows were found."
        columns={[
          {
            key: "organization",
            header: "Organization",
            render: (subscription) => (
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{subscription.organization.name}</p>
                <p className="text-[var(--color-muted)]">{subscription.planCode}</p>
              </div>
            ),
          },
          {
            key: "billing",
            header: "Billing",
            render: (subscription) => (
              <div>
                <p>{subscription.currencyCode}</p>
                <p className="text-[var(--color-muted)]">{subscription.countryCode}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (subscription) => <StatusBadge value={subscription.status} />,
          },
          {
            key: "provider",
            header: "Provider",
            render: (subscription) => <span>{subscription.provider}</span>,
          },
        ]}
      />
    </AdminShell>
  );
}
