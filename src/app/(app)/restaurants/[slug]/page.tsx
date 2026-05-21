import { notFound } from "next/navigation";
import Link from "next/link";
import { CommerceSafetyNotice } from "@/components/commerce/commerce-safety-notice";
import { PublicReviewList, RatingSummary } from "@/components/reviews/review-components";
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
import { getSellerVerificationGate } from "@/server/seller-verification-gates";
import { getPublicSellerVerificationBadges } from "@/server/seller-verifications";
import { getStorageImageUrl, resolveStorageImageUrls } from "@/server/storage/storage-images";
import { getPublicSellerReviewSummary, listPublicSellerReviews } from "@/server/trust/review-service";

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
  const publicGate = await getSellerVerificationGate({
    organizationId: restaurant.id,
    sellerType: "restaurant",
    countryCode: restaurant.countryCode,
    capability: "public_profile",
  });
  if (!publicGate.allowed) notFound();
  const [menuItems, socialLinks, logoUrl, coverUrl, sellerBadges, reviewSummary, reviews] = await Promise.all([
    listPublicMenuItemsForOrganization(restaurant.id),
    listPublicBusinessSocialLinks(restaurant.id, "restaurant"),
    getStorageImageUrl(session, restaurant.logoFileId),
    getStorageImageUrl(session, restaurant.coverPhotoFileId),
    getPublicSellerVerificationBadges(restaurant.id),
    getPublicSellerReviewSummary(restaurant.id),
    listPublicSellerReviews(restaurant.id),
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
        badges={sellerBadges.map((badge) => <SellerVerificationBadge key={`seller-verification-${badge.label}`} label={badge.label} tone={badge.tone} />)}
        actions={<ContactActions href="/orders" label="View my orders" />}
      />
      <ProfileSection title="Social links">
        <SocialLinksRow links={socialLinks} />
      </ProfileSection>
      <RatingSummary averageRating={reviewSummary.averageRating} ratingCount={reviewSummary.ratingCount} />
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
      <PublicReviewList reviews={reviews} />
      <CommerceSafetyNotice />
    </div>
  );
}
