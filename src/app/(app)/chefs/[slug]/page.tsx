import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessChefMarketplace, getPublicChefProfile } from "@/server/chefs";

export const dynamic = "force-dynamic";

const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function ChefPublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await requireMembership();
  const { slug } = await params;
  const enabled = await canAccessChefMarketplace({ organizationId: session.activeOrganization.id, platformRole: session.user.platformRole });
  if (!enabled) notFound();
  const chef = await getPublicChefProfile(slug, session.activeOrganization.id);
  if (!chef) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home chef"
        title={chef.displayName}
        description={chef.bio}
        actions={<Button asChild><Link href={`/chefs/${chef.slug}/request`}>Request this chef</Link></Button>}
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone="success">Approved public profile</Badge>
        {chef.verificationStatus === "verified" ? <Badge tone="success">Verified</Badge> : null}
        {chef.baseCity ? <Badge tone="info">{chef.baseCity}{chef.baseRegion ? `, ${chef.baseRegion}` : ""}</Badge> : null}
        {chef.yearsExperience ? <Badge tone="neutral">{chef.yearsExperience} years experience</Badge> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Services</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {chef.services.filter((service) => service.isActive).map((service) => (
                <div key={service.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                  <p className="font-semibold text-[var(--color-ink)]">{service.name}</p>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">{service.description ?? service.serviceType.replace(/_/g, " ")}</p>
                  <p className="mt-3 text-sm font-semibold text-[var(--color-ink)]">
                    {service.basePriceAmount ? `${service.basePriceAmount} ${service.currencyCode}` : "Price TBD"} · {service.priceUnit.replace(/_/g, " ")}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Specialties</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {Array.isArray(chef.specialties) ? chef.specialties.map((item) => <Badge key={String(item)} tone="info">{String(item)}</Badge>) : null}
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {chef.specialtyRecipes.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-[var(--color-ink)]">{item.dishName}</p>
                  {item.notes ? <p className="mt-2 text-sm text-[var(--color-muted)]">{item.notes}</p> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Availability</h2>
            <div className="mt-4 space-y-3">
              {chef.availability.filter((slot) => slot.isAvailable).length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">Availability has not been published yet.</p>
              ) : (
                chef.availability.filter((slot) => slot.isAvailable).map((slot) => (
                  <div key={slot.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <span className="font-medium text-[var(--color-ink)]">{dayLabels[slot.dayOfWeek]}</span>
                    <span className="text-[var(--color-muted)]">{slot.startTime} - {slot.endTime}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold text-[var(--color-ink)]">Important</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              Requests are still manually reviewed by NizamKitchen support. No live booking or payment is collected here.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
