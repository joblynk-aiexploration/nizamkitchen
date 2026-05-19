import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getPublicHomeCateringProfile } from "@/server/home-catering";

export const dynamic = "force-dynamic";

export default async function CatererDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireMembership();
  const { slug } = await params;
  const profile = await getPublicHomeCateringProfile(slug, session.activeOrganization.id);
  if (!profile) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home catering seller"
        title={profile.displayName}
        description={profile.city ? `${profile.city}${profile.region ? `, ${profile.region}` : ""}` : "Service area details coming soon"}
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone="success">Verified</Badge>
        {profile.acceptsPickup ? <Badge tone="info">Pickup</Badge> : null}
        {profile.acceptsDelivery ? <Badge tone="info">Delivery</Badge> : null}
        {profile.acceptsPreorders ? <Badge tone="info">Preorders</Badge> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">About</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{profile.bio || "This seller has not added a bio yet."}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {Array.isArray(profile.cuisineSpecialtiesJson)
              ? profile.cuisineSpecialtiesJson.map((item) => <Badge key={String(item)} tone="info">{String(item)}</Badge>)
              : null}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Request flow</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Menu and order request management are coming later. No live payments or credit cards are connected.
          </p>
          <Button className="mt-5 w-full justify-center" variant="secondary" disabled>
            Order requests coming soon
          </Button>
        </Card>
      </div>
    </div>
  );
}
