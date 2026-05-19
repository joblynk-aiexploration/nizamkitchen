import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { listBillingPlans } from "@/server/billing/plans";
import { getSubscriptionForOrg } from "@/server/billing/subscriptions";
import { createSubscriptionCheckoutAction } from "../actions";

export const dynamic = "force-dynamic";

const stripeConfigured =
  Boolean(process.env.STRIPE_SECRET_KEY) &&
  process.env.STRIPE_SECRET_KEY !== "";

export default async function BillingPlansPage() {
  const session = await requireMembership();
  const [plans, subscription] = await Promise.all([
    listBillingPlans("active"),
    getSubscriptionForOrg(session.activeOrganization.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Available plans"
        description="Choose the plan that fits your household or business."
      />

      {!stripeConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Payments are not configured yet. Plan upgrades will be available once payment integration is set up. Contact support to change your plan manually.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = subscription?.planId === plan.id;
          const features = Array.isArray(plan.featuresJson)
            ? (plan.featuresJson as string[])
            : [];
          const priceNum = Number(plan.priceAmount);

          return (
            <Card key={plan.id} className={isCurrent ? "ring-2 ring-[var(--color-primary)]" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{plan.name}</p>
                  {plan.description && (
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{plan.description}</p>
                  )}
                </div>
                {isCurrent && <Badge tone="success">Current</Badge>}
              </div>

              <div className="mt-4">
                {priceNum === 0 ? (
                  <p className="text-2xl font-bold text-[var(--color-ink)]">Free</p>
                ) : (
                  <p className="text-2xl font-bold text-[var(--color-ink)]">
                    ${priceNum.toFixed(2)}
                    <span className="text-sm font-normal text-[var(--color-muted)]">
                      /{plan.billingInterval === "custom" ? "custom" : plan.billingInterval === "yearly" ? "yr" : "mo"}
                    </span>
                  </p>
                )}
              </div>

              {features.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-ink)]">
                      <span className="mt-0.5 text-emerald-500">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6">
                {isCurrent ? (
                  <span className="block w-full rounded-2xl border border-[var(--color-border)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--color-muted)]">
                    Your current plan
                  </span>
                ) : plan.stripePriceId ? (
                  <form action={createSubscriptionCheckoutAction}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <button className="block w-full rounded-2xl bg-[var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-white">
                      Pay subscription
                    </button>
                  </form>
                ) : (
                  <span className="block w-full rounded-2xl border border-[var(--color-border)] px-4 py-2.5 text-center text-xs text-[var(--color-muted)]">
                    Contact support to upgrade
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
