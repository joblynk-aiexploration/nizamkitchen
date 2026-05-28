import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { listAllSubscriptions } from "@/server/billing/subscriptions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminBillingSubscriptionsPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);

  const subscriptions = await listAllSubscriptions(session);

  return (
    <AdminShell
      session={session}
      title="Subscriptions"
      description="All organization billing subscriptions."
    >
      <AdminDataTable
        data={subscriptions}
        emptyMessage="No subscriptions found."
        columns={[
          {
            key: "organization",
            header: "Organization",
            render: (sub) => (
              <div>
                <Link
                  href={`/admin/organizations`}
                  className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]"
                >
                  {sub.organization.name}
                </Link>
                <p className="text-xs text-[var(--color-muted)]">{sub.organization.countryCode}</p>
              </div>
            ),
          },
          {
            key: "plan",
            header: "Plan",
            render: (sub) => (
              <div>
                <p className="font-medium text-[var(--color-ink)]">{sub.plan.name}</p>
                <p className="text-xs text-[var(--color-muted)]">{sub.plan.slug}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (sub) => (
              <Badge
                tone={
                  sub.status === "active"
                    ? "success"
                    : sub.status === "trialing"
                      ? "info"
                      : sub.status === "cancelled"
                        ? "danger"
                        : "neutral"
                }
              >
                {sub.status}
              </Badge>
            ),
          },
          {
            key: "provider",
            header: "Provider",
            render: (sub) => <span className="text-sm">{sub.provider}</span>,
          },
          {
            key: "period",
            header: "Period end",
            render: (sub) => (
              <span className="text-sm text-[var(--color-muted)]">
                {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "—"}
              </span>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
