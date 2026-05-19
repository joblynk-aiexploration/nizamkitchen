import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { canAccessHomeCatering, listPublicHomeCateringProfiles } from "@/server/home-catering";

export const dynamic = "force-dynamic";

export default async function CaterersPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; cuisine?: string; pickup?: string; delivery?: string; preorder?: string }>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const enabled = await canAccessHomeCatering({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled) {
    return <EmptyState title="Home catering coming soon" description="Caterer browsing is not enabled for this organization yet." />;
  }

  const profiles = await listPublicHomeCateringProfiles({
    organizationId: session.activeOrganization.id,
    city: params.city,
    cuisine: params.cuisine,
    pickup: params.pickup === "on",
    delivery: params.delivery === "on",
    preorder: params.preorder === "on",
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home catering"
        title="Browse home catering sellers"
        description="Find verified sellers who prepare dishes from their own kitchen for pickup, delivery, or pre-order."
      />

      <Card>
        <form className="grid gap-4 md:grid-cols-5">
          <TextInput label="City" name="city" defaultValue={params.city ?? ""} />
          <TextInput label="Cuisine or dish" name="cuisine" defaultValue={params.cuisine ?? ""} />
          <label className="flex items-end gap-2 pb-3 text-sm text-[var(--color-ink)]"><input type="checkbox" name="pickup" defaultChecked={params.pickup === "on"} /> Pickup</label>
          <label className="flex items-end gap-2 pb-3 text-sm text-[var(--color-ink)]"><input type="checkbox" name="delivery" defaultChecked={params.delivery === "on"} /> Delivery</label>
          <label className="flex items-end gap-2 pb-3 text-sm text-[var(--color-ink)]"><input type="checkbox" name="preorder" defaultChecked={params.preorder === "on"} /> Preorder</label>
          <div className="md:col-span-5"><Button type="submit">Filter caterers</Button></div>
        </form>
      </Card>

      {profiles.length === 0 ? (
        <EmptyState title="No matching caterers" description="Try broadening your filters or check back after more home catering profiles are approved." />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <Link key={profile.id} href={`/caterers/${profile.slug}`} className="block">
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--color-ink)]">{profile.displayName}</h2>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{profile.city ?? "Service area TBD"}{profile.region ? `, ${profile.region}` : ""}</p>
                  </div>
                  <Badge tone="success">Verified</Badge>
                </div>
                {profile.bio ? <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--color-muted)]">{profile.bio}</p> : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  {Array.isArray(profile.cuisineSpecialtiesJson)
                    ? profile.cuisineSpecialtiesJson.slice(0, 4).map((item) => <Badge key={String(item)} tone="info">{String(item)}</Badge>)
                    : null}
                </div>
                <p className="mt-5 text-sm font-semibold text-[var(--color-ink)]">
                  {[profile.acceptsPickup ? "Pickup" : null, profile.acceptsDelivery ? "Delivery" : null, profile.acceptsPreorders ? "Preorder" : null].filter(Boolean).join(" · ")}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
