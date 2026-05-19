import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicSocialLinks } from "@/components/business-social-links/social-link-components";
import { CommerceSafetyNotice } from "@/components/commerce/commerce-safety-notice";
import { StorageImage } from "@/components/storage/storage-image";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { getPublicHomeCateringProfile } from "@/server/home-catering";
import { listPublicMenuItemsForOrganization } from "@/server/menus";
import { listPublicBusinessSocialLinks } from "@/server/business-social-links";
import { getStorageImageUrl, resolveStorageImageUrls } from "@/server/storage/storage-images";

export const dynamic = "force-dynamic";

export default async function CatererDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireMembership();
  const { slug } = await params;
  const profile = await getPublicHomeCateringProfile(slug, session.activeOrganization.id);
  if (!profile) notFound();
  const [menuItems, socialLinks, profileImageUrl, coverImageUrl] = await Promise.all([
    listPublicMenuItemsForOrganization(profile.organizationId),
    listPublicBusinessSocialLinks(profile.organizationId, "home_catering"),
    getStorageImageUrl(session, profile.profilePhotoFileId, profile.profilePhotoUrl),
    getStorageImageUrl(session, profile.coverPhotoFileId, profile.coverPhotoUrl),
  ]);
  const menuImageUrls = await resolveStorageImageUrls(session, menuItems, (item) => item.photoFileId, (item) => item.photoUrl);

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
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <StorageImage src={profileImageUrl} alt={`${profile.displayName} profile photo`} className="h-52 w-full rounded-3xl object-cover" fallbackLabel="Seller photo coming soon" />
        <StorageImage src={coverImageUrl} alt={`${profile.displayName} cover photo`} className="h-52 w-full rounded-3xl object-cover" fallbackLabel="Cover photo coming soon" />
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
            Request dishes from this seller as a manual inquiry. Payment is handled directly with the seller for now.
          </p>
          <Button className="mt-5 w-full justify-center" variant="secondary" asChild>
            <Link href="/orders">View my orders</Link>
          </Button>
        </Card>

        <PublicSocialLinks links={socialLinks} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Menu</h2>
        {menuItems.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted)]">No active menu items have been published yet.</p> : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {menuItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <StorageImage src={menuImageUrls[item.id]} alt={item.name} className="mb-4 h-40 w-full rounded-2xl object-cover" fallbackLabel="Dish photo coming soon" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{item.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{item.category.replace(/_/g, " ")}</p>
                </div>
                <Badge tone={item.status === "sold_out" ? "warning" : "success"}>{item.status === "sold_out" ? "Sold out" : "Available"}</Badge>
              </div>
              {item.description ? <p className="mt-3 text-sm text-[var(--color-muted)]">{item.description}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {item.preorderRequired ? <Badge tone="info">Preorder</Badge> : null}
                {item.pickupAvailable ? <Badge tone="info">Pickup</Badge> : null}
                {item.deliveryAvailable ? <Badge tone="info">Delivery</Badge> : null}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="font-semibold">{item.priceAmount ? `${item.currencyCode} ${item.priceAmount}` : "Price TBD"}</p>
                {item.status === "active" ? (
                  <Button variant="secondary" asChild><Link href={`/orders/new?menuItemId=${item.id}`}>Request order</Link></Button>
                ) : (
                  <Button variant="secondary" disabled>Sold out</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <CommerceSafetyNotice />
    </div>
  );
}
