import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { listBillingPlans } from "@/server/billing/plans";
import { getSubscriptionForOrg } from "@/server/billing/subscriptions";
import { getStripePaymentReadiness } from "@/server/payments/payment-readiness";
import { createSubscriptionCheckoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function BillingPlansPage({ searchParams }: { searchParams: Promise<{ message?: string; payment?: string }> }) {
  const session = await requireMembership();
  const [plans, subscription, stripeReadiness, query] = await Promise.all([
    listBillingPlans("active"),
    getSubscriptionForOrg(session.activeOrganization.id),
    getStripePaymentReadiness({
      countryCode: session.activeOrganization.countryCode,
      currencyCode: session.activeOrganization.currencyCode,
    }),
    searchParams,
  ]);
  const stripeConfigured = stripeReadiness.configured;
  const paymentMessage =
    query.payment === "cancelled"
      ? "Checkout was cancelled. Your plan was not changed, and you can choose a plan whenever you are ready."
      : null;
  const currentPlan = subscription?.plan;
  const payablePlans = plans.filter((plan) => Number(plan.priceAmount) > 0 && plan.billingInterval !== "custom").length;
  const freePlans = plans.filter((plan) => Number(plan.priceAmount) === 0).length;
  const customPlans = plans.filter((plan) => plan.billingInterval === "custom").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Available plans"
        description="Compare plans, start secure checkout, and keep billing decisions clear for your household or business."
      />
      <FormMessage message={query.message ?? paymentMessage} />

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.85fr]">
        <Card className="overflow-hidden p-0">
          <div className="bg-[linear-gradient(135deg,#091827_0%,#0d4f49_58%,#176f62_100%)] p-7 text-white md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
                  Plan marketplace
                </p>
                <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
                  Choose the right NizamKitchen plan.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50/85">
                  Upgrade when you need more meal planning capacity, household sharing, grocery exports, chef requests, or seller workflow support.
                </p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  Current plan
                </p>
                <p className="mt-2 text-2xl font-bold">{currentPlan?.name ?? "Free / Starter"}</p>
                <div className="mt-4">
                  <Badge tone={subscription?.status === "active" ? "success" : subscription?.status === "trialing" ? "info" : "neutral"}>
                    {subscription?.status ?? "free"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <PlanMetric label="Self-service plans" value={String(payablePlans)} />
              <PlanMetric label="Free options" value={String(freePlans)} />
              <PlanMetric label="Custom plans" value={String(customPlans)} />
            </div>
          </div>
        </Card>

        <Card className={stripeConfigured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-3 w-3 rounded-full ${stripeConfigured ? "bg-emerald-500" : "bg-amber-500"}`} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                Checkout status
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">
                {stripeConfigured ? "Secure Stripe checkout is ready" : "Manual plan changes only"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                {stripeConfigured
                  ? "Paid plans open hosted checkout. Your subscription activates after Stripe confirms the payment."
                  : `Payments are not fully configured yet. ${stripeReadiness.message} Contact support to change your plan manually.`}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/billing"
                  className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
                >
                  Back to billing
                </Link>
                {!stripeConfigured && (
                  <Link
                    href="/support/new"
                    className="rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Contact support
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Card>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = subscription?.planId === plan.id && ["active", "trialing", "free"].includes(subscription.status);
          const features = Array.isArray(plan.featuresJson)
            ? (plan.featuresJson as string[])
            : [];
          const priceNum = Number(plan.priceAmount);
          const canCheckout = stripeConfigured && priceNum > 0 && plan.billingInterval !== "custom";
          const interval = intervalLabel(plan.billingInterval);
          const recommended = !isCurrent && priceNum > 0 && plan.billingInterval !== "custom";
          const ctaCopy = canCheckout ? "Continue to secure checkout" : isCurrent ? "Your current plan" : plan.billingInterval === "custom" ? "Talk to support" : "Contact support to upgrade";

          return (
            <Card
              key={plan.id}
              className={`relative flex min-h-full flex-col overflow-hidden ${isCurrent ? "ring-2 ring-[var(--color-primary)]" : ""}`}
            >
              {recommended && (
                <div className="absolute right-5 top-5">
                  <Badge tone="info">Upgrade option</Badge>
                </div>
              )}

              <div className="flex items-start justify-between gap-4 pr-24">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                    {plan.billingInterval === "custom" ? "Custom" : priceNum === 0 ? "Starter" : "Self-service"}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{plan.name}</h3>
                  {plan.description && (
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{plan.description}</p>
                  )}
                </div>
                {isCurrent && <Badge tone="success">Current</Badge>}
              </div>

              <div className="mt-6 rounded-3xl bg-slate-50 p-5">
                {priceNum === 0 ? (
                  <p className="text-4xl font-bold text-[var(--color-ink)]">Free</p>
                ) : (
                  <p className="text-4xl font-bold text-[var(--color-ink)]">
                    {formatMoney(plan.currencyCode, priceNum)}
                    <span className="ml-1 text-sm font-normal text-[var(--color-muted)]">
                      /{interval}
                    </span>
                  </p>
                )}
                <p className="mt-2 text-xs font-medium text-[var(--color-muted)]">
                  {plan.billingInterval === "custom"
                    ? "Custom terms and billing cadence"
                    : priceNum === 0
                      ? "No payment required"
                      : "Secure hosted checkout, no card data stored by NizamKitchen"}
                </p>
              </div>

              {features.length > 0 && (
                <ul className="mt-6 space-y-3">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-ink)]">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                        ✓
                      </span>
                      <span className="leading-6">{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto pt-6">
                {isCurrent ? (
                  <span className="block w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-900">
                    {ctaCopy}
                  </span>
                ) : canCheckout ? (
                  <form action={createSubscriptionCheckoutAction}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <label className="mb-3 flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
                      <span>Promo code</span>
                      <input
                        name="promotionCode"
                        className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-slate-500 focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]/25"
                        placeholder="Optional"
                        maxLength={40}
                      />
                    </label>
                    <button className="block w-full rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-950/10 transition hover:-translate-y-0.5 hover:opacity-90">
                      {ctaCopy}
                    </button>
                    <p className="mt-2 text-xs leading-5 text-[var(--color-muted)]">
                      Promo codes are checked securely on the server before Stripe checkout opens.
                    </p>
                  </form>
                ) : plan.billingInterval === "custom" ? (
                  <Link
                    href="/support/new"
                    className="block w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
                  >
                    {ctaCopy}
                  </Link>
                ) : (
                  <Link
                    href="/support/new"
                    className="block w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-muted)] hover:bg-slate-50"
                  >
                    {ctaCopy}
                  </Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="bg-slate-50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
              Billing assurance
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">
              Payments stay secure and subscription changes are tracked.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">
              Card details are handled by the enabled payment gateway. NizamKitchen records the subscription, invoice, receipt, and audit trail after checkout succeeds.
            </p>
          </div>
          <Link
            href="/billing/invoices"
            className="inline-flex shrink-0 justify-center rounded-2xl border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
          >
            View invoices
          </Link>
        </div>
      </Card>
    </div>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-100">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function formatMoney(currencyCode: string, amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

function intervalLabel(interval: string) {
  if (interval === "yearly") return "year";
  if (interval === "custom") return "custom";
  return "month";
}
