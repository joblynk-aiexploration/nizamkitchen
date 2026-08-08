import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommerceSafetyNotice } from "@/components/commerce/commerce-safety-notice";
import { StorageImage } from "@/components/storage/storage-image";
import { ContactActions, MenuPreviewSection, ProfileHeader, ProfileSection, ReviewsPreviewSection, SocialLinksRow, VerificationBadge, initialsFromName } from "@/components/profiles/profile-components";
import { PublicReviewList, RatingSummary } from "@/components/reviews/review-components";
import { SellerVerificationBadge } from "@/components/seller-verifications/verification-badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { hasPlatformRole, PLATFORM_ADMIN_ROLES } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getPublicHomeCateringProfile } from "@/server/home-catering";
import { listPublicMenuItemsForOrganization } from "@/server/menus";
import { listPublicBusinessSocialLinks } from "@/server/business-social-links";
import { getPublicSellerVerificationBadges } from "@/server/seller-verifications";
import { getStorageImageUrl, resolveStorageImageUrls } from "@/server/storage/storage-images";
import { getPublicSellerReviewSummary, listPublicSellerReviews } from "@/server/trust/review-service";

export const dynamic = "force-dynamic";

export default async function CatererDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireMembership();
  const { slug } = await params;
  const orgId = session.activeOrganization.id;

  const featureEnabled = await isFeatureEnabled("home_catering", orgId);
  if (!featureEnabled && !hasPlatformRole(session.user.platformRole, PLATFORM_ADMIN_ROLES)) {
    notFound();
  }

  const profile = await getPublicHomeCateringProfile(slug, orgId);
  if (!profile) notFound();
  const [menuItems, socialLinks, profileImageUrl, coverImageUrl, sellerBadges, reviewSummary, reviews] = await Promise.all([
    listPublicMenuItemsForOrganization(profile.organizationId),
    listPublicBusinessSocialLinks(profile.organizationId, "home_catering"),
    getStorageImageUrl(session, profile.profilePhotoFileId, profile.profilePhotoUrl),
    getStorageImageUrl(session, profile.coverPhotoFileId, profile.coverPhotoUrl),
    getPublicSellerVerificationBadges(profile.organizationId),
    getPublicSellerReviewSummary(profile.organizationId),
    listPublicSellerReviews(profile.organizationId),
  ]);
  const menuImageUrls = await resolveStorageImageUrls(session, menuItems, (item) => item.photoFileId, (item) => item.photoUrl);
  const firstAvailableMenuItem = menuItems.find((item) => item.status === "active");
  const placeOrderHref = firstAvailableMenuItem ? `/orders/new?menuItemId=${firstAvailableMenuItem.id}` : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home catering seller"
        title="Caterer profile"
        description="Browse seller specialties, menu items, social links, and manual order request options."
      />
      <ProfileHeader
        coverUrl={coverImageUrl}
        avatarUrl={profileImageUrl}
        name={profile.displayName}
        headline={profile.bio}
        location={profile.city ? `${profile.city}${profile.region ? `, ${profile.region}` : ""}` : null}
        initials={initialsFromName(profile.displayName)}
        badges={[
          <VerificationBadge key="verification" status={profile.verificationStatus} />,
          ...sellerBadges.map((badge) => <SellerVerificationBadge key={`seller-verification-${badge.label}`} label={badge.label} tone={badge.tone} />),
          profile.acceptsPickup ? <Badge key="pickup" tone="info">Pickup</Badge> : null,
          profile.acceptsDelivery ? <Badge key="delivery" tone="info">Delivery</Badge> : null,
          profile.acceptsPreorders ? <Badge key="preorder" tone="info">Preorders</Badge> : null,
        ].filter(Boolean)}
        actions={
          <div className="flex flex-wrap gap-2">
            {placeOrderHref ? (
              <ContactActions href={placeOrderHref} label="Place my order" />
            ) : null}
            <Button variant={placeOrderHref ? "secondary" : "primary"} asChild>
              <Link href="/orders">View my orders</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ProfileSection title="About">
          <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{profile.bio || "This seller has not added a bio yet."}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {Array.isArray(profile.cuisineSpecialtiesJson)
              ? profile.cuisineSpecialtiesJson.map((item) => <Badge key={String(item)} tone="info">{String(item)}</Badge>)
              : null}
          </div>
        </ProfileSection>

        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Request flow</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Request dishes from this seller. Pay securely at checkout, or arrange payment with the seller.
          </p>
          {placeOrderHref ? (
            <Button className="mt-5 w-full justify-center" asChild>
              <Link href={placeOrderHref}>Place my order</Link>
            </Button>
          ) : (
            <p className="mt-5 rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
              This caterer does not have an available item to order yet.
            </p>
          )}
          <Button className="mt-3 w-full justify-center" variant="secondary" asChild>
            <Link href="/orders">View my orders</Link>
          </Button>
        </Card>

        <ProfileSection title="Social links">
          <SocialLinksRow links={socialLinks} />
        </ProfileSection>
        <ReviewsPreviewSection rating={profile.averageRating} count={profile.ratingCount} />
        <RatingSummary averageRating={reviewSummary.averageRating} ratingCount={reviewSummary.ratingCount} />
      </div>

      <MenuPreviewSection>
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
                  <Button variant="secondary" asChild><Link href={`/orders/new?menuItemId=${item.id}`}>Place order</Link></Button>
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
