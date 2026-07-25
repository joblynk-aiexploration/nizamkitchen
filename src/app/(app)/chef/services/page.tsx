import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { canAccessChefMarketplace, getChefProfileForOrganization, isChefBusiness } from "@/server/chefs";
import { upsertChefServiceAction } from "../actions";

export const dynamic = "force-dynamic";

const serviceTypeOptions = [
  { value: "daily_cooking", label: "Daily cooking" },
  { value: "weekly_cooking", label: "Weekly cooking" },
  { value: "occasion", label: "Occasion" },
  { value: "meal_prep", label: "Meal prep" },
  { value: "recipe_specific", label: "Recipe specific" },
  { value: "custom", label: "Custom" },
];

const priceUnitOptions = [
  { value: "per_visit", label: "Per visit" },
  { value: "per_day", label: "Per day" },
  { value: "per_week", label: "Per week" },
  { value: "per_event", label: "Per event" },
  { value: "per_guest", label: "Per guest" },
  { value: "custom", label: "Custom" },
];

export default async function ChefServicesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const params = await searchParams;
  const enabled = await canAccessChefMarketplace({ organizationId: session.activeOrganization.id, platformRole: session.user.platformRole });
  if (!enabled || !isChefBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Chef services unavailable" description="Chef service tools are available only for enabled chef businesses." />;
  }
  const profile = await getChefProfileForOrganization(session.activeOrganization.id);
  if (!profile) {
    return <EmptyState title="Create a chef profile first" description="Services attach to your chef profile." />;
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Chef marketplace" title="Services" description="Manage the cooking services customers can request from your chef profile." />
      {params.message ? <Card className="border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-800">{params.message}</Card> : null}

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
                <ChefServiceForm
                  className="mt-5"
                  currencyCode={session.activeOrganization.currencyCode}
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

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Add service</h2>
        <ChefServiceForm currencyCode={session.activeOrganization.currencyCode} submitLabel="Add service" />
      </Card>
    </div>
  );
}

function ChefServiceForm({
  className,
  currencyCode,
  service,
  submitLabel,
}: {
  className?: string;
  currencyCode: string;
  service?: {
    id: string;
    name: string;
    description: string | null;
    serviceType: string;
    basePriceAmount: number | null;
    currencyCode: string;
    priceUnit: string;
    minGuests: number | null;
    maxGuests: number | null;
    isActive: boolean;
  };
  submitLabel: string;
}) {
  return (
    <form action={upsertChefServiceAction} className={`grid gap-4 md:grid-cols-2 ${className ?? "mt-5"}`}>
      {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}
      <TextInput label="Service name" name="name" defaultValue={service?.name ?? ""} required />
      <SelectInput label="Service type" name="serviceType" options={serviceTypeOptions} defaultValue={service?.serviceType ?? "daily_cooking"} />
      <TextInput label="Base price" name="basePriceAmount" type="number" min={0} step="0.01" defaultValue={service?.basePriceAmount ?? ""} />
      <TextInput label="Currency" name="currencyCode" defaultValue={service?.currencyCode ?? currencyCode} maxLength={3} />
      <SelectInput label="Price unit" name="priceUnit" options={priceUnitOptions} defaultValue={service?.priceUnit ?? "per_visit"} />
      <TextInput label="Min guests" name="minGuests" type="number" min={1} defaultValue={service?.minGuests ?? ""} />
      <TextInput label="Max guests" name="maxGuests" type="number" min={1} defaultValue={service?.maxGuests ?? ""} />
      <label className="flex items-end gap-2 pb-3 text-sm font-medium text-[var(--color-ink)]">
        <input type="checkbox" name="isActive" defaultChecked={service?.isActive ?? true} />
        Active
      </label>
      <div className="md:col-span-2"><TextArea label="Description" name="description" defaultValue={service?.description ?? ""} /></div>
      <div className="md:col-span-2"><Button type="submit">{submitLabel}</Button></div>
    </form>
  );
}

function formatServicePrice(amount: number | null, currencyCode: string, priceUnit: string) {
  const unit = priceUnit.replace(/_/g, " ");
  return amount ? `${amount.toFixed(2)} ${currencyCode} · ${unit}` : `Price TBD · ${unit}`;
}
