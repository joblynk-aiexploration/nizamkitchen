import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { TextInput } from "@/components/ui/text-input";
import { formatDate } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { getSellerUsage } from "@/server/billing/seller-usage";
import { getSubscriptionHistory } from "@/server/billing/admin-ops";
import { getLimitOverrides, ALL_LIMIT_KEYS } from "@/server/billing/limit-overrides";
import {
  grantEnterprisePlanAction,
  setLimitOverrideAction,
  clearLimitOverridesAction,
  resetMonthlyUsageAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminOrgBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const [session, { orgId }, query] = await Promise.all([
    requirePlatformRole(["platform_owner", "platform_admin", "support_admin"]),
    params,
    searchParams,
  ]);
  const canManage =
    session.user.platformRole === "platform_owner" ||
    session.user.platformRole === "platform_admin";

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      organizationType: true,
      status: true,
      billingSubscriptions: {
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!org) notFound();

  const isHousehold = org.organizationType === "household";
  const activeSubscription = org.billingSubscriptions[0] ?? null;

  const [usage, overrides, history] = await Promise.all([
    isHousehold ? null : getSellerUsage(orgId).catch(() => null),
    getLimitOverrides(orgId),
    getSubscriptionHistory(session, orgId),
  ]);

  return (
    <AdminShell
      session={session}
      title={org.name}
      description={`Billing management for ${org.name} (${org.organizationType.replace(/_/g, " ")})`}
    >
      <Link
        href="/admin/billing/subscriptions"
        className="text-sm text-[var(--color-primary)] hover:underline"
      >
        ← Back to subscriptions
      </Link>

      <FormMessage message={query.message} />

      {/* Current subscription */}
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Current subscription</h2>
        {activeSubscription ? (
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Plan</span>
              <span className="font-medium">{activeSubscription.plan.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Status</span>
              <Badge
                tone={
                  activeSubscription.status === "active"
                    ? "success"
                    : activeSubscription.status === "cancelled"
                      ? "danger"
                      : "neutral"
                }
              >
                {activeSubscription.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-muted)]">Provider</span>
              <span className="font-medium">{activeSubscription.provider}</span>
            </div>
            {activeSubscription.currentPeriodEnd && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-muted)]">Period ends</span>
                <span className="font-medium">{formatDate(activeSubscription.currentPeriodEnd)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No subscription found.</p>
        )}

        {/* Grant Enterprise */}
        {canManage && !isHousehold && (
          <form action={grantEnterprisePlanAction} className="mt-5 border-t border-[var(--color-border)] pt-5">
            <input type="hidden" name="organizationId" value={orgId} />
            <p className="text-sm text-[var(--color-muted)]">
              Grant the enterprise plan for this org&apos;s audience. This creates a new manual
              subscription with status=active.
            </p>
            <Button type="submit" variant="secondary" className="mt-3">
              Grant enterprise plan
            </Button>
          </form>
        )}
      </Card>

      {/* Usage (non-household only) */}
      {!isHousehold && usage && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="font-semibold text-[var(--color-ink)]">Current usage</h2>
            {canManage && (
              <form action={resetMonthlyUsageAction}>
                <input type="hidden" name="organizationId" value={orgId} />
                <Button type="submit" variant="secondary">Reset monthly usage</Button>
              </form>
            )}
          </div>
          <div className="mt-4 divide-y divide-[var(--color-border)]">
            {usage.metrics.map((m) => {
              const isUnlim = m.limit === Infinity || m.limit === 0;
              const pct = isUnlim ? 0 : Math.min(100, Math.round((m.current / m.limit) * 100));
              const barColor = pct >= 100 ? "bg-[var(--color-danger)]" : pct >= 80 ? "bg-amber-500" : "bg-[var(--color-primary)]";
              return (
                <div key={m.key} className="py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-muted)]">{m.label}</span>
                    <span className="font-semibold">
                      {m.current}{" "}
                      <span className="font-normal text-[var(--color-muted)]">
                        / {isUnlim ? "∞" : m.limit}
                      </span>
                    </span>
                  </div>
                  {!isUnlim && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Limit overrides */}
      {canManage && !isHousehold && (
        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Limit overrides</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Override plan limits for this org. Set to -1 for unlimited. Leave blank to keep plan
            default. Overrides stack on top of the plan — they always win.
          </p>

          {Object.keys(overrides).length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p className="font-semibold text-amber-800">Active overrides</p>
              <ul className="mt-2 space-y-1">
                {(Object.entries(overrides) as [string, number][]).map(([key, val]) => (
                  <li key={key} className="text-amber-700">
                    {key}: {val === -1 ? "unlimited" : val}
                  </li>
                ))}
              </ul>
              <form action={clearLimitOverridesAction} className="mt-3">
                <input type="hidden" name="organizationId" value={orgId} />
                <Button type="submit" variant="danger">Clear all overrides</Button>
              </form>
            </div>
          )}

          <form action={setLimitOverrideAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="organizationId" value={orgId} />
            {ALL_LIMIT_KEYS.map((key) => (
              <TextInput
                key={key}
                label={key}
                name={key}
                type="number"
                defaultValue={overrides[key] !== undefined ? String(overrides[key]) : ""}
                placeholder={`plan default${overrides[key] !== undefined ? ` (currently ${overrides[key]})` : ""}`}
              />
            ))}
            <div className="md:col-span-2">
              <Button type="submit">Save overrides</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Subscription history */}
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Billing history</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No billing events recorded.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {history.map((event) => (
              <div key={event.id} className="flex flex-col gap-0.5 border-b border-[var(--color-border)] py-2 text-sm last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-[var(--color-ink)]">
                    {event.action.replace(/_/g, " ").replace("billing.", "")}
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">{formatDate(event.createdAt)}</span>
                </div>
                {event.actorUser && (
                  <span className="text-xs text-[var(--color-muted)]">
                    by {event.actorUser.fullName ?? event.actorUser.email ?? event.actorUser.id}
                  </span>
                )}
                {event.details && (
                  <pre className="mt-1 overflow-x-auto rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
