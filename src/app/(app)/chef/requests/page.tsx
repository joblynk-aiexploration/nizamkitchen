import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isChefOrganization, listChefHomeChefRequestsForViewer } from "@/server/home-chef";
import { getSellerUsage, isMetricAtLimit, isMetricUnlimited } from "@/server/billing/seller-usage";
import { UpgradeModal } from "@/components/commerce/upgrade-modal";

export const dynamic = "force-dynamic";

export default async function ChefRequestsPage() {
  const session = await requireMembership();

  if (!isChefOrganization(session.activeOrganization.organizationType)) {
    return (
      <EmptyState
        title="Chef organization required"
        description="Assigned home-chef requests are visible only to chef business organizations."
      />
    );
  }

  const [requests, usage] = await Promise.all([
    listChefHomeChefRequestsForViewer({ session }),
    getSellerUsage(session.activeOrganization.id),
  ]);

  const bookingMetric = usage.metrics.find((m) => m.key === "bookings");
  const showBookingUsage = bookingMetric && !isMetricUnlimited(bookingMetric);
  const atBookingLimit = bookingMetric ? isMetricAtLimit(bookingMetric) : false;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Chef workspace"
        title="Orders"
        description="Review household orders assigned to your chef profile. Open an order to see details, chat, accept, or decline."
      />

      {showBookingUsage && bookingMetric && (
        <BookingUsageBanner
          metric={bookingMetric}
          atLimit={atBookingLimit}
          planName={usage.entitlement.planName}
          upgradePlans={usage.upgradePlans}
        />
      )}

      {requests.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="When a household places an order for your chef profile, it will appear here."
        />
      ) : (
        <div className="space-y-8">
          <RequestSection
            title="Assigned to you"
            description="Orders that belong to your chef profile."
            emptyMessage="No orders are assigned to your chef profile yet."
            requests={requests}
          />
        </div>
      )}
    </div>
  );
}

function BookingUsageBanner({
  metric,
  atLimit,
  planName,
  upgradePlans,
}: {
  metric: { label: string; current: number; limit: number };
  atLimit: boolean;
  planName: string;
  upgradePlans: Array<{ slug: string; name: string; tier: string; billingInterval: "monthly" | "yearly" | "custom"; priceAmount: number; featuresJson: string[] }>;
}) {
  const pct = Math.min(100, Math.round((metric.current / metric.limit) * 100));
  const nearLimit = !atLimit && pct >= 80;
  const remaining = Math.max(0, metric.limit - metric.current);
  const barColor = atLimit ? "bg-[var(--color-danger)]" : nearLimit ? "bg-amber-500" : "bg-[var(--color-primary)]";

  return (
    <Card className={atLimit ? "border-red-200 bg-red-50/60" : nearLimit ? "border-amber-200 bg-amber-50/60" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bookings this month</p>
          <p className={`text-2xl font-bold ${atLimit ? "text-[var(--color-danger)]" : nearLimit ? "text-amber-600" : "text-[var(--color-ink)]"}`}>
            {metric.current} <span className="text-sm font-normal text-[var(--color-muted)]">/ {metric.limit}</span>
          </p>
        </div>
        {(atLimit || nearLimit) && upgradePlans.length > 0 && (
          <UpgradeModal
            trigger={<Button variant={atLimit ? "warning" : "secondary"}>Upgrade plan</Button>}
            currentPlanName={planName}
            limitLabel="Bookings"
            current={metric.current}
            limit={metric.limit}
            upgradePlans={upgradePlans}
          />
        )}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`mt-2 text-xs ${atLimit ? "font-medium text-[var(--color-danger)]" : nearLimit ? "text-amber-600" : "text-[var(--color-muted)]"}`}>
        {atLimit
          ? "None remaining — upgrade to accept more bookings."
          : nearLimit
          ? `${remaining} remaining — consider upgrading your plan.`
          : `${remaining} remaining`}
      </p>
    </Card>
  );
}

function RequestSection({
  title,
  description,
  emptyMessage,
  requests,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  requests: Awaited<ReturnType<typeof listChefHomeChefRequestsForViewer>>;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
      </div>
      {requests.length === 0 ? (
        <Card className="text-sm text-[var(--color-muted)]">{emptyMessage}</Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={request.currentOffer?.status === "pending" ? "warning" : "success"}>
                      {request.currentOffer?.status === "pending" ? "Offer pending" : "Assigned to you"}
                    </Badge>
                    <Badge tone="info">{request.requestType.replace(/_/g, " ")}</Badge>
                    <Badge tone="neutral">{request.status}</Badge>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-[var(--color-ink)]">{request.title}</h3>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {request.requestedDate.toLocaleDateString()} · {request.guestCount} guests · {request.generalLocation}
                  </p>
                  {request.currentOffer?.status === "pending" ? (
                    <p className="mt-2 text-sm font-semibold text-amber-700">
                      Respond by {request.currentOffer.responseDeadlineAt.toLocaleString()}
                    </p>
                  ) : null}
                </div>
                {request.recipe ? (
                  <div className="flex flex-col gap-2 text-sm font-semibold md:items-end">
                    <Link href={`/chef/requests/${request.id}`} className="text-[var(--color-primary)]">
                      View order
                    </Link>
                    <Link href={`/recipes/${request.recipe.id}`} className="text-[var(--color-muted)]">
                      View recipe
                    </Link>
                  </div>
                ) : (
                  <Link href={`/chef/requests/${request.id}`} className="text-sm font-semibold text-[var(--color-primary)]">
                    View order
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
