import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { listMemberAccountingDocuments } from "@/server/accounting/accounting-service";
import { getSubscriptionForOrg } from "@/server/billing/subscriptions";
import { getPlanLimits } from "@/server/billing/plan-limits";
import { formatDate } from "@/lib/utils";
import { getStripePaymentReadiness } from "@/server/payments/payment-readiness";
import { finalizeStripeSubscriptionCheckout } from "@/server/payments/providers/stripe/stripe-adapter";

export const dynamic = "force-dynamic";

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

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ payment?: string; message?: string; session_id?: string }> }) {
  const session = await requireMembership();
  const query = await searchParams;
  let checkoutMessage: string | null = null;
  if (query.payment === "success" && query.session_id) {
    try {
      await finalizeStripeSubscriptionCheckout({
        sessionId: query.session_id,
        userId: session.user.id,
        organizationId: session.activeOrganization.id,
      });
      checkoutMessage = "Payment successful. Your subscription is active, and your invoice and receipt are available in Billing.";
    } catch (error) {
      checkoutMessage = error instanceof Error
        ? `Payment return could not be finalized yet: ${error.message}`
        : "Payment return could not be finalized yet. If Stripe confirmed your payment, your plan will activate from the payment webhook shortly.";
    }
  }

  const [subscription, stripeReadiness, invoices, receipts] = await Promise.all([
    getSubscriptionForOrg(session.activeOrganization.id),
    getStripePaymentReadiness({
      countryCode: session.activeOrganization.countryCode,
      currencyCode: session.activeOrganization.currencyCode,
    }),
    listMemberAccountingDocuments(session, "invoice"),
    listMemberAccountingDocuments(session, "receipt"),
  ]);
  const stripeConfigured = stripeReadiness.configured;
  const limits = getPlanLimits(subscription?.plan ?? { slug: "free", limitsJson: {} });
  const plan = subscription?.plan;
  const priceAmount = Number(plan?.priceAmount ?? 0);
  const planPrice = priceAmount > 0
    ? `${formatMoney(plan?.currencyCode ?? session.activeOrganization.currencyCode ?? "USD", priceAmount)}/${intervalLabel(plan?.billingInterval ?? "monthly")}`
    : "Free";
  const subscriptionStatus = subscription?.status ?? "free";
  const latestInvoice = invoices[0] ?? null;
  const latestReceipt = receipts[0] ?? null;
  const paymentMessage =
    checkoutMessage
      ? checkoutMessage
      : query.payment === "success"
      ? "Payment received. Your subscription is being confirmed and will activate as soon as Stripe sends the payment confirmation."
      : query.payment === "cancelled"
        ? "Checkout was cancelled. Your plan was not changed."
        : query.message ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Billing center"
        description="Manage your plan, payment status, invoices, receipts, and billing support from one secure workspace."
      />
      <FormMessage message={paymentMessage} />

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <Card className="overflow-hidden p-0">
          <div className="bg-[linear-gradient(135deg,#081826_0%,#0f4f49_58%,#176f62_100%)] p-7 text-white md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
                  Current subscription
                </p>
                <h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
                  {plan?.name ?? "Free / Starter"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85">
                  {plan?.description ?? "Start with core planning tools, then upgrade when your household or seller workflow needs more capacity."}
                </p>
              </div>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">Plan price</p>
                <p className="mt-2 text-3xl font-bold">{planPrice}</p>
                <div className="mt-4">
                  <Badge tone={subscriptionStatus === "active" ? "success" : subscriptionStatus === "trialing" ? "info" : "neutral"}>
                    {subscriptionStatus}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <HeroMetric label="Workspace" value={session.activeOrganization.name} />
              <HeroMetric label="Billing country" value={session.activeOrganization.countryCode} />
              <HeroMetric label="Currency" value={plan?.currencyCode ?? session.activeOrganization.currencyCode ?? "USD"} />
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-3">
            <StatusTile
              label="Payment gateway"
              value={stripeConfigured ? "Stripe checkout ready" : "Manual billing"}
              detail={stripeConfigured ? "Self-service payments are enabled." : stripeReadiness.message}
              tone={stripeConfigured ? "success" : "warning"}
            />
            <StatusTile
              label="Renewal"
              value={subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "Not scheduled"}
              detail={subscription?.currentPeriodEnd ? "Your plan renews on this date." : "No recurring renewal date is available yet."}
              tone="neutral"
            />
            <StatusTile
              label="Trial"
              value={subscription?.trialEndsAt ? formatDate(subscription.trialEndsAt) : "No active trial"}
              detail={subscription?.trialEndsAt ? "Trial benefits remain active until this date." : "Your account is not currently in a trial period."}
              tone="neutral"
            />
          </div>
        </Card>

        <div className="grid gap-4">
          <ActionCard
            eyebrow="Plan management"
            title="Change or upgrade your plan"
            description={stripeConfigured ? "Choose a plan and complete secure hosted checkout." : "Plan changes are manual until a payment gateway is enabled."}
            href="/billing/plans"
            cta={stripeConfigured ? "View plans" : "Review plans"}
            primary
          />
          <ActionCard
            eyebrow="Refund help"
            title="Need a refund review?"
            description="Request a refund review for a paid invoice or subscription payment. The billing team can approve and process eligible refunds from the platform."
            href={latestInvoice ? `/billing/refunds/new?paymentOrderId=${latestInvoice.paymentOrderId}` : "/billing/refunds/new"}
            cta="Request a refund"
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Plan limits</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Included with your plan</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">Usage limits are enforced server-side and update when your subscription changes.</p>
            </div>
            <Link href="/billing/usage" className="rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50">
              Usage history
            </Link>
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
        </Card>

        <div className="grid gap-4">
          <DocumentSummary
            title="Latest invoice"
            href={latestInvoice ? `/billing/invoices/${latestInvoice.id}` : "/billing/invoices"}
            empty="No invoice issued yet"
            documentNumber={latestInvoice?.documentNumber}
            amount={latestInvoice ? formatMoney(latestInvoice.currencyCode, Number(latestInvoice.totalAmount)) : null}
            issuedAt={latestInvoice?.issuedAt}
          />
          <DocumentSummary
            title="Latest receipt"
            href={latestReceipt ? `/billing/receipts/${latestReceipt.id}` : "/billing/receipts"}
            empty="No receipt issued yet"
            documentNumber={latestReceipt?.documentNumber}
            amount={latestReceipt ? formatMoney(latestReceipt.currencyCode, Number(latestReceipt.totalAmount)) : null}
            issuedAt={latestReceipt?.issuedAt}
          />
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-100">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusTile({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "success" | "warning" | "neutral" }) {
  const dotClass = tone === "success" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-slate-400";
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-slate-50/70 p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{detail}</p>
    </div>
  );
}

function ActionCard({ eyebrow, title, description, href, cta, primary = false }: { eyebrow: string; title: string; description: string; href: string; cta: string; primary?: boolean }) {
  return (
    <Card className={primary ? "border-emerald-200 bg-emerald-50" : ""}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">{eyebrow}</p>
      <h2 className="mt-3 text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
      <Link
        href={href}
        className={primary
          ? "mt-5 inline-flex rounded-2xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          : "mt-5 inline-flex rounded-2xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] hover:bg-slate-50"
        }
      >
        {cta}
      </Link>
    </Card>
  );
}

function DocumentSummary({ title, href, empty, documentNumber, amount, issuedAt }: { title: string; href: string; empty: string; documentNumber?: string | null; amount?: string | null; issuedAt?: Date | null }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <p className="mt-3 font-semibold text-[var(--color-ink)]">{documentNumber ?? empty}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {issuedAt ? `Issued ${formatDate(issuedAt)}` : "Documents appear here after a successful payment."}
          </p>
        </div>
        {amount ? <p className="shrink-0 font-semibold text-[var(--color-ink)]">{amount}</p> : null}
      </div>
      <Link href={href} className="mt-5 inline-flex text-sm font-semibold text-[var(--color-primary)] hover:underline">
        {documentNumber ? "Open document" : "View all"}
      </Link>
    </Card>
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
