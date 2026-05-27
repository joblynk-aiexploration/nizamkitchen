import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { canAccessChefMarketplace, listPublicChefProfiles } from "@/server/chefs";

export const dynamic = "force-dynamic";

const serviceTypeOptions = [
  { value: "", label: "Any service" },
  { value: "daily_cooking", label: "Daily cooking" },
  { value: "weekly_cooking", label: "Weekly cooking" },
  { value: "occasion", label: "Occasion" },
  { value: "meal_prep", label: "Meal prep" },
  { value: "recipe_specific", label: "Recipe specific" },
  { value: "custom", label: "Custom" },
];

export default async function ChefsMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; region?: string; specialty?: string; serviceType?: string; verifiedOnly?: string }>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const enabled = await canAccessChefMarketplace({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled) {
    return <EmptyState title="Chef marketplace coming soon" description="Home chef browsing is not enabled for this organization yet." />;
  }

  const chefs = await listPublicChefProfiles({
    organizationId: session.activeOrganization.id,
    city: params.city,
    region: params.region,
    specialty: params.specialty,
    serviceType: params.serviceType,
    verifiedOnly: params.verifiedOnly === "on",
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home chef marketplace"
        title="Browse home chefs"
        description="Browse approved public chef profiles. Draft, suspended, disabled, and private profiles are hidden."
      />

      <Card>
        <form className="grid gap-4 md:grid-cols-5">
          <TextInput label="City" name="city" defaultValue={params.city ?? ""} />
          <TextInput label="Region" name="region" defaultValue={params.region ?? ""} />
          <TextInput label="Specialty" name="specialty" defaultValue={params.specialty ?? ""} />
          <SelectInput label="Service" name="serviceType" defaultValue={params.serviceType ?? ""} options={serviceTypeOptions} />
          <label className="flex items-end gap-2 pb-3 text-sm text-[var(--color-ink)]">
            <input type="checkbox" name="verifiedOnly" defaultChecked={params.verifiedOnly === "on"} />
            Verified only
          </label>
          <div className="md:col-span-5"><Button type="submit">Filter chefs</Button></div>
        </form>
      </Card>

      {chefs.length === 0 ? (
        <EmptyState title="No matching chefs" description="Try broadening your filters or check back after more chef profiles are approved." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {chefs.map((chef) => (
            <Link key={chef.id} href={`/chefs/${chef.slug}`} className="block">
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--color-ink)]">{chef.displayName}</h2>
                    <p className="mt-1 text-sm font-medium text-[var(--color-muted)]">{chef.organization.name}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{chef.baseCity ?? "Service area TBD"}{chef.baseRegion ? `, ${chef.baseRegion}` : ""}</p>
                  </div>
                  {chef.verificationStatus === "verified" ? <Badge tone="success">Verified</Badge> : null}
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--color-muted)]">{chef.bio}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {Array.isArray(chef.specialties) ? chef.specialties.slice(0, 4).map((item) => <Badge key={String(item)} tone="info">{String(item)}</Badge>) : null}
                </div>
                <p className="mt-5 text-sm font-semibold text-[var(--color-ink)]">{chef.services.length} active services</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
