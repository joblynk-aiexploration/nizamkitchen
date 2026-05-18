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

export default async function ChefServicesPage() {
  const session = await requireMembership();
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
      <PageHeader eyebrow="Chef marketplace" title="Services" description="Pricing is a placeholder only. Payments are not integrated." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {profile.services.map((service) => (
          <Card key={service.id}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-[var(--color-ink)]">{service.name}</h2>
              <Badge tone={service.isActive ? "success" : "neutral"}>{service.isActive ? "Active" : "Inactive"}</Badge>
            </div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{service.description ?? "No description."}</p>
            <p className="mt-4 text-sm font-semibold text-[var(--color-ink)]">
              {service.basePriceAmount ? `${service.basePriceAmount} ${service.currencyCode}` : "Price TBD"} · {service.priceUnit.replace(/_/g, " ")}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Add service</h2>
        <form action={upsertChefServiceAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <TextInput label="Service name" name="name" required />
          <SelectInput label="Service type" name="serviceType" options={serviceTypeOptions} />
          <TextInput label="Base price" name="basePriceAmount" type="number" min={0} step="0.01" />
          <TextInput label="Currency" name="currencyCode" defaultValue={session.activeOrganization.currencyCode} maxLength={3} />
          <SelectInput label="Price unit" name="priceUnit" options={priceUnitOptions} />
          <TextInput label="Min guests" name="minGuests" type="number" min={1} />
          <TextInput label="Max guests" name="maxGuests" type="number" min={1} />
          <label className="flex items-end gap-2 pb-3 text-sm text-[var(--color-ink)]">
            <input type="checkbox" name="isActive" defaultChecked />
            Active
          </label>
          <div className="md:col-span-2"><TextArea label="Description" name="description" /></div>
          <div className="md:col-span-2"><Button type="submit">Save service</Button></div>
        </form>
      </Card>
    </div>
  );
}
