import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getSubscriptionForOrg } from "@/server/billing/subscriptions";
import { getPlanLimits } from "@/server/billing/plan-limits";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const stripeConfigured =
  Boolean(process.env.STRIPE_SECRET_KEY) &&
  process.env.STRIPE_SECRET_KEY !== "";

function LimitRow({ label, value }: { label: string; value: number | boolean }) {
  if (typeof value === "boolean") {
    return (
      <div className="flex items-center justify-between py-2 text-sm">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className={value ? "font-medium text-emerald-600" : "text-slate-400"}>
          {value ? "Included" : "Not included"}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-medium text-[var(--color-ink)]">
        {value === -1 ? "Unlimited" : value}
      </span>
    </div>
  );
}

export default async function BillingPage() {
  const session = await requireMembership();
  const subscription = await getSubscriptionForOrg(session.activeOrganization.id);
  const limits = getPlanLimits(subscription?.plan ?? { slug: "free", limitsJson: {} });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Billing & plan"
        description="Your current plan and usage limits."
      />

      {!stripeConfigured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Payments are not configured yet. Billing management will be available once payment integration is set up.
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Current plan
            </p>
            <p className="mt-2 text-2xl font-bold text-[var(--color-ink)]">
              {subscription?.plan.name ?? "Free / Starter"}
            </p>
            {subscription?.plan.description && (
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {subscription.plan.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge
              tone={
                subscription?.status === "active"
                  ? "success"
                  : subscription?.status === "trialing"
                    ? "info"
                    : "neutral"
              }
            >
              {subscription?.status ?? "free"}
            </Badge>
            {subscription?.currentPeriodEnd && (
              <p className="text-xs text-[var(--color-muted)]">
                Renews {formatDate(subscription.currentPeriodEnd)}
              </p>
            )}
            {subscription?.trialEndsAt && (
              <p className="text-xs text-amber-700">
                Trial ends {formatDate(subscription.trialEndsAt)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 divide-y divide-[var(--color-border)]">
          <LimitRow label="Meal plans" value={limits.maxMealPlans} />
          <LimitRow label="Grocery lists per month" value={limits.maxGroceryListsPerMonth} />
          <LimitRow label="Household members" value={limits.maxHouseholdMembers} />
          <LimitRow label="Saved restaurants" value={limits.maxSavedRestaurants} />
          <LimitRow label="Chef requests per month" value={limits.maxChefRequestsPerMonth} />
          <LimitRow label="Chef marketplace" value={limits.chefMarketplaceEnabled} />
          <LimitRow label="Grocery exports" value={limits.groceryExportsEnabled} />
          <LimitRow label="Restaurant search" value={limits.restaurantFallbackEnabled} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-4">
          <Link
            href="/billing/plans"
            className="rounded-2xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            View all plans
          </Link>
          <Link
            href="/billing/usage"
            className="rounded-2xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
          >
            Usage history
          </Link>
        </div>
      </Card>
    </div>
  );
}
