import { notFound } from "next/navigation";
import Link from "next/link";
import { CommerceSafetyNotice } from "@/components/commerce/commerce-safety-notice";
import { StorageImage } from "@/components/storage/storage-image";
import { ContactActions, MenuPreviewSection, ProfileHeader, ProfileSection, SocialLinksRow, initialsFromName } from "@/components/profiles/profile-components";
import { SellerVerificationBadge } from "@/components/seller-verifications/verification-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { listPublicBusinessSocialLinks } from "@/server/business-social-links";
import { listPublicMenuItemsForOrganization } from "@/server/menus";
import { getPublicSellerVerificationBadge } from "@/server/seller-verifications";
import { getStorageImageUrl, resolveStorageImageUrls } from "@/server/storage/storage-images";

export const dynamic = "force-dynamic";

export default async function RestaurantProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireMembership();
  const enabled = await isFeatureEnabled("restaurant_profiles", session.activeOrganization.id);
  if (!enabled) notFound();
  const { slug } = await params;
  const restaurant = await prisma.organization.findFirst({
    where: { slug, organizationType: "restaurant", status: "active" },
    select: { id: true, name: true, countryCode: true, logoFileId: true, coverPhotoFileId: true },
  });
  if (!restaurant) notFound();
  const [menuItems, socialLinks, logoUrl, coverUrl, sellerBadge] = await Promise.all([
    listPublicMenuItemsForOrganization(restaurant.id),
    listPublicBusinessSocialLinks(restaurant.id, "restaurant"),
    getStorageImageUrl(session, restaurant.logoFileId),
    getStorageImageUrl(session, restaurant.coverPhotoFileId),
    getPublicSellerVerificationBadge(restaurant.id),
  ]);
  const menuImageUrls = await resolveStorageImageUrls(session, menuItems, (item) => item.photoFileId, (item) => item.photoUrl);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Restaurant partner" title={restaurant.name} description="Browse menu items and submit manual order requests. Payment is handled directly with the restaurant for now." />
      <ProfileHeader
        coverUrl={coverUrl}
        avatarUrl={logoUrl}
        name={restaurant.name}
        headline="Restaurant partner serving public menu items through manual order requests."
        location={restaurant.countryCode}
        initials={initialsFromName(restaurant.name)}
        badges={[<SellerVerificationBadge key="seller-verification" label={sellerBadge.label} tone={sellerBadge.tone} />]}
        actions={<ContactActions href="/orders" label="View my orders" />}
      />
      <ProfileSection title="Social links">
        <SocialLinksRow links={socialLinks} />
      </ProfileSection>
      <MenuPreviewSection>
        {menuItems.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted)]">No active public menu items have been published yet.</p> : null}
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
      </MenuPreviewSection>
      <CommerceSafetyNotice />
    </div>
  );
}
