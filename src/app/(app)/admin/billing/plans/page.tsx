import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listBillingPlans } from "@/server/billing/plans";
import { getPlanLimits } from "@/server/billing/plan-limits";

export const dynamic = "force-dynamic";

export default async function AdminBillingPlansPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const plans = await listBillingPlans();

  return (
    <AdminShell
      session={session}
      title="Billing plans"
      description="View and manage all billing plans. Plans are currently seeded and edited via the admin interface."
    >
      <div className="space-y-4">
        {plans.map((plan) => {
          const limits = getPlanLimits(plan);
          const features = Array.isArray(plan.featuresJson) ? (plan.featuresJson as string[]) : [];
          const priceNum = Number(plan.priceAmount);

          return (
            <Card key={plan.id}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[var(--color-ink)]">{plan.name}</h2>
                    <Badge
                      tone={
                        plan.status === "active"
                          ? "success"
                          : plan.status === "draft"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {plan.status}
                    </Badge>
                    <Badge tone="neutral">{plan.slug}</Badge>
                  </div>
                  {plan.description && (
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{plan.description}</p>
                  )}
                  <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]">
                    {priceNum === 0
                      ? "Free"
                      : `$${priceNum.toFixed(2)} / ${plan.billingInterval}`}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Limits</p>
                  <div className="mt-1 space-y-0.5 text-xs text-[var(--color-muted)]">
                    <p>Meal plans: {limits.maxMealPlans === -1 ? "∞" : limits.maxMealPlans}</p>
                    <p>Grocery lists/mo: {limits.maxGroceryListsPerMonth === -1 ? "∞" : limits.maxGroceryListsPerMonth}</p>
                    <p>Chef requests/mo: {limits.maxChefRequestsPerMonth === -1 ? "∞" : limits.maxChefRequestsPerMonth}</p>
                  </div>
                </div>
              </div>

              {features.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {features.map((f, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
        Plans are seeded via <code className="font-mono text-xs">prisma/seed.ts</code>. Full plan creation/editing UI will be added when payment integration is configured.
      </div>
    </AdminShell>
  );
}
