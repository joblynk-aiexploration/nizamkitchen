import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { listBillingPlans } from "@/server/billing/plans";
import { listAllSubscriptions } from "@/server/billing/subscriptions";
import { formatDate } from "@/lib/utils";
import { changeAdminSubscriptionPlanAction, cancelAdminSubscriptionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminBillingSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);
  const query = await searchParams;

  const [subscriptions, activePlans] = await Promise.all([
    listAllSubscriptions(session),
    listBillingPlans("active"),
  ]);
  const canManageSubscriptions = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";
  const planOptions = activePlans.map((plan) => ({
    value: plan.id,
    label: `${plan.name} - ${plan.currencyCode} ${Number(plan.priceAmount).toFixed(2)} / ${plan.billingInterval}`,
  }));

  return (
    <AdminShell
      session={session}
      title="Subscriptions"
      description="All organization billing subscriptions. Platform owners can change plans or cancel subscriptions from here."
    >
      <FormMessage message={query.message} />
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
          {
            key: "actions",
            header: "Actions",
            width: "340px",
            render: (sub) => canManageSubscriptions ? (
              <div className="space-y-3">
                <form action={changeAdminSubscriptionPlanAction} className="grid gap-2">
                  <input type="hidden" name="subscriptionId" value={sub.id} />
                  <SelectInput
                    label="Change plan"
                    name="planId"
                    defaultValue={sub.planId}
                    options={planOptions}
                  />
                  <Button type="submit" variant="secondary" className="w-full">Change user plan</Button>
                </form>
                <form action={cancelAdminSubscriptionAction} className="grid gap-2">
                  <input type="hidden" name="subscriptionId" value={sub.id} />
                  <Button type="submit" variant="danger" className="w-full" disabled={sub.status === "cancelled"}>
                    Cancel subscription
                  </Button>
                  {sub.provider === "stripe" && sub.providerSubscriptionId ? (
                    <p className="text-xs leading-5 text-amber-700">
                      Also confirm cancellation in Stripe for this provider subscription.
                    </p>
                  ) : null}
                </form>
              </div>
            ) : (
              <span className="text-xs text-[var(--color-muted)]">Platform owner/admin only</span>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
