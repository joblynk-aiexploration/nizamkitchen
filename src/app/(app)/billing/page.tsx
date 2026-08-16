import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMembership, requireUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { listMemberAccountingDocuments } from "@/server/accounting/accounting-service";
import { getSubscriptionForOrg } from "@/server/billing/subscriptions";
import { type Entitlement, type PlanAudience } from "@/server/billing/entitlements";
import { getSellerUsage, type UsageMetric } from "@/server/billing/seller-usage";
import { formatCalendarDate, formatDate } from "@/lib/utils";
import { getStripePaymentReadiness } from "@/server/payments/payment-readiness";
import { finalizeStripeSubscriptionCheckout } from "@/server/payments/providers/stripe/stripe-adapter";

export const dynamic = "force-dynamic";

function resolveDisplayAudience(planAudience: PlanAudience, orgType: string): PlanAudience {
  if (planAudience !== "none") return planAudience;
  if (orgType === "chef_business") return "chef_staff";
  if (orgType === "home_catering") return "home_catering";
  if (orgType === "restaurant") return "restaurant";
  return "household";
}

function UsageLimitRow({ label, current, limit }: { label: string; current: number | null; limit: number }) {
  const unlimited = limit === Infinity;
  let display: string;
  if (unlimited) {
    display = current !== null ? `${current} (Unlimited)` : "Unlimited";
  } else if (current !== null) {
    display = `${current} of ${limit}`;
  } else {
    display = String(limit);
  }
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-medium text-[var(--color-ink)]">{display}</span>
    </div>
  );
}

function PlanLimitRows({
  entitlement,
  sellerMetrics,
  orgType,
}: {
  entitlement: Entitlement;
  sellerMetrics: UsageMetric[];
  orgType: string;
}) {
  const { limits, features } = entitlement;
  const audience = resolveDisplayAudience(entitlement.planAudience, orgType);
  const metric = (key: string) => sellerMetrics.find((m) => m.key === key) ?? null;

  if (audience === "chef_staff") {
    const svc = metric("services");
    const bkng = metric("bookings");
    const staff = metric("staff");
    return (
      <>
        <UsageLimitRow label="Active services" current={svc?.current ?? null} limit={limits.maxActiveServices} />
        <LimitRow label="Menu items" value={limits.maxMenuItems} />
        <UsageLimitRow label="Bookings per month" current={bkng?.current ?? null} limit={limits.maxBookingsPerMonth} />
        {limits.maxStaffMembers > 0 && (
          <UsageLimitRow label="Staff members" current={staff?.current ?? null} limit={limits.maxStaffMembers} />
        )}
        <LimitRow label="Analytics" value={features.analytics} />
        <LimitRow label="Customer messaging" value={features.customerMessaging} />
        <LimitRow label="Priority listing" value={features.priorityPlacement} />
        <LimitRow label="Promotions" value={features.promotions} />
      </>
    );
  }

  if (audience === "home_catering") {
    const pkgs = metric("menuItems");
    const orders = metric("orders");
    const staff = metric("staff");
    return (
      <>
        <UsageLimitRow label="Packages" current={pkgs?.current ?? null} limit={limits.maxMenuItems} />
        <UsageLimitRow label="Orders per month" current={orders?.current ?? null} limit={limits.maxOrdersPerMonth} />
        {limits.maxStaffMembers > 0 && (
          <UsageLimitRow label="Staff members" current={staff?.current ?? null} limit={limits.maxStaffMembers} />
        )}
        <LimitRow label="Analytics" value={features.analytics} />
        <LimitRow label="Customer messaging" value={features.customerMessaging} />
        <LimitRow label="Priority listing" value={features.priorityPlacement} />
      </>
    );
  }

  if (audience === "restaurant") {
    const items = metric("menuItems");
    const orders = metric("orders");
    const staff = metric("staff");
    return (
      <>
        <UsageLimitRow label="Menu items" current={items?.current ?? null} limit={limits.maxMenuItems} />
        <UsageLimitRow label="Orders per month" current={orders?.current ?? null} limit={limits.maxOrdersPerMonth} />
        <LimitRow label="Locations" value={limits.maxLocations} />
        {limits.maxStaffMembers > 0 && (
          <UsageLimitRow label="Staff members" current={staff?.current ?? null} limit={limits.maxStaffMembers} />
        )}
        <LimitRow label="Analytics" value={features.analytics} />
        <LimitRow label="Customer messaging" value={features.customerMessaging} />
      </>
    );
  }

  return (
    <>
      <LimitRow label="Meal plans" value={limits.maxMealPlans} />
      <LimitRow label="Grocery lists per month" value={limits.maxGroceryListsPerMonth} />
      <LimitRow label="Household members" value={limits.maxHouseholdMembers} />
      <LimitRow label="Saved restaurants" value={limits.maxSavedRestaurants} />
      <LimitRow label="Chef requests per month" value={limits.maxChefRequestsPerMonth} />
      <LimitRow label="Chef marketplace" value={features.chefMarketplace} />
      <LimitRow label="Grocery exports" value={features.groceryExports} />
      <LimitRow label="Restaurant search" value={features.restaurantSearch} />
    </>
  );
}

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
        {value === Infinity || value === -1 ? "Unlimited" : value}
      </span>
    </div>
  );
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ payment?: string; message?: string; session_id?: string }> }) {
  const userSession = await requireUser();
  if (userSession.user.platformRole === "platform_owner" || userSession.user.platformRole === "platform_admin") {
    redirect("/admin/billing");
  }

  const session = await requireMembership();

  if (session.activeOrganization.organizationType === "household") {
    redirect(`/household?message=${encodeURIComponent("Household accounts are always free — no billing required.")}`);
  }

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

  const [subscription, sellerUsage, stripeReadiness, invoices, receipts] = await Promise.all([
    getSubscriptionForOrg(session.activeOrganization.id),
    getSellerUsage(session.activeOrganization.id),
    getStripePaymentReadiness({
      countryCode: session.activeOrganization.countryCode,
      currencyCode: session.activeOrganization.currencyCode,
    }),
    listMemberAccountingDocuments(session, "invoice"),
    listMemberAccountingDocuments(session, "receipt"),
  ]);
  const entitlement = sellerUsage.entitlement;
  const stripeConfigured = stripeReadiness.configured;
  const plan = subscription?.plan;
  const priceAmount = Number(plan?.priceAmount ?? 0);
  const planPrice = priceAmount > 0
    ? `${formatMoney(plan?.currencyCode ?? session.activeOrganization.currencyCode ?? "USD", priceAmount)}/${intervalLabel(plan?.billingInterval ?? "monthly")}`
    : "Free";
  const subscriptionStatus = subscription?.status ?? "free";
  const FREE_PLAN_NAME: Record<string, string> = {
    chef_business: "Chef Free",
    home_catering: "Catering Free",
    restaurant: "Restaurant Free",
  };
  const FREE_PLAN_DESCRIPTION: Record<string, string> = {
    chef_business: "Start your home chef business with a public profile and core request tools.",
    home_catering: "Launch your catering operation with core order tools.",
    restaurant: "Get your restaurant listed and start accepting orders.",
  };
  const planDisplayName = plan?.name ?? FREE_PLAN_NAME[session.activeOrganization.organizationType] ?? "Free";
  const planDisplayDescription =
    plan?.description ??
    FREE_PLAN_DESCRIPTION[session.activeOrganization.organizationType] ??
    "Start with core planning tools, then upgrade when you need more capacity.";
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
                  {planDisplayName}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85">
                  {planDisplayDescription}
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
              value={subscription?.currentPeriodEnd ? formatCalendarDate(subscription.currentPeriodEnd) : "Not scheduled"}
              detail={subscription?.currentPeriodEnd ? "Your plan renews on this date." : "No recurring renewal date is available yet."}
              tone="neutral"
            />
            <StatusTile
              label="Trial"
              value={subscription?.trialEndsAt ? formatCalendarDate(subscription.trialEndsAt) : "No active trial"}
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
            <PlanLimitRows
              entitlement={entitlement}
              sellerMetrics={sellerUsage.metrics}
              orgType={session.activeOrganization.organizationType}
            />
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
