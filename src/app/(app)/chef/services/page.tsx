import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/auth/session";
import { canAccessChefMarketplace, getChefProfileForOrganization, isChefBusiness } from "@/server/chefs";
import { getSellerUsage, isMetricAtLimit, isMetricUnlimited } from "@/server/billing/seller-usage";
import { UpgradeModal } from "@/components/commerce/upgrade-modal";
import { ServiceForm } from "./service-form";

export const dynamic = "force-dynamic";

export default async function ChefServicesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const params = await searchParams;
  const enabled = await canAccessChefMarketplace({ organizationId: session.activeOrganization.id, platformRole: session.user.platformRole });
  if (!enabled || !isChefBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Chef services unavailable" description="Chef service tools are available only for enabled chef businesses." />;
  }
  const [profile, usage] = await Promise.all([
    getChefProfileForOrganization(session.activeOrganization.id),
    getSellerUsage(session.activeOrganization.id),
  ]);
  if (!profile) {
    return <EmptyState title="Create a chef profile first" description="Services attach to your chef profile." />;
  }

  const serviceMetric = usage.metrics.find((m) => m.key === "services");
  const atServiceLimit = serviceMetric ? isMetricAtLimit(serviceMetric) : false;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Chef marketplace" title="Services" description="Manage the cooking services customers can request from your chef profile." />
      <FormMessage message={params.message} />

      {profile.services.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {profile.services.map((service) => (
            <Card key={service.id} className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[var(--color-ink)]">{service.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {formatServicePrice(service.basePriceAmount, service.currencyCode, service.priceUnit)}
                  </p>
                </div>
                <Badge tone={service.isActive ? "success" : "neutral"}>{service.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="text-sm text-[var(--color-muted)]">{service.description ?? "No description."}</p>
              <details className="rounded-2xl border border-[var(--color-border)] bg-slate-50/70 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--color-primary)]">Edit service</summary>
                <ServiceForm
                  className="mt-5"
                  orgCurrencyCode={session.activeOrganization.currencyCode}
                  service={{
                    id: service.id,
                    name: service.name,
                    description: service.description,
                    serviceType: service.serviceType,
                    basePriceAmount: service.basePriceAmount,
                    currencyCode: service.currencyCode,
                    priceUnit: service.priceUnit,
                    minGuests: service.minGuests,
                    maxGuests: service.maxGuests,
                    isActive: service.isActive,
                  }}
                  submitLabel="Update service"
                />
              </details>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No services yet" description="Add your first cooking service so customers know what they can request." />
      )}

      {serviceMetric && !isMetricUnlimited(serviceMetric) && (
        <ServiceUsageBanner
          metric={serviceMetric}
          atLimit={atServiceLimit}
          planName={usage.entitlement.planName}
          upgradePlans={usage.upgradePlans}
        />
      )}

      {!atServiceLimit && (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Add service</h2>
          <ServiceForm orgCurrencyCode={session.activeOrganization.currencyCode} submitLabel="Add service" />
        </Card>
      )}
    </div>
  );
}

function formatServicePrice(amount: number | null, currencyCode: string, priceUnit: string) {
  const unit = priceUnit.replace(/_/g, " ");
  return amount ? `${amount.toFixed(2)} ${currencyCode} · ${unit}` : `Price TBD · ${unit}`;
}

function ServiceUsageBanner({
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Services</p>
          <p className={`text-2xl font-bold ${atLimit ? "text-[var(--color-danger)]" : nearLimit ? "text-amber-600" : "text-[var(--color-ink)]"}`}>
            {metric.current} <span className="text-sm font-normal text-[var(--color-muted)]">/ {metric.limit}</span>
          </p>
        </div>
        {(atLimit || nearLimit) && upgradePlans.length > 0 && (
          <UpgradeModal
            trigger={<Button variant={atLimit ? "warning" : "secondary"}>Upgrade plan</Button>}
            currentPlanName={planName}
            limitLabel="Services"
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
          ? "None remaining — upgrade to add more services."
          : nearLimit
          ? `${remaining} remaining — consider upgrading your plan.`
          : `${remaining} remaining`}
      </p>
    </Card>
  );
}
