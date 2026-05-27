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

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(value: string) {
  const [hourText, minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteText.padStart(2, "0")} ${suffix}`;
}

export default async function RestaurantProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requireMembership();
  const enabled = await isFeatureEnabled("restaurant_profiles", session.activeOrganization.id);
  if (!enabled) notFound();
  const { slug } = await params;
  const restaurant = await prisma.organization.findFirst({
    where: { slug, organizationType: "restaurant", status: "active" },
    select: {
      id: true,
      name: true,
      countryCode: true,
      logoFileId: true,
      coverPhotoFileId: true,
      menus: {
        where: { status: "active", visibility: "public" },
        select: { id: true, name: true, description: true, _count: { select: { items: true } } },
        orderBy: { updatedAt: "desc" },
      },
      fulfillmentPickupLocations: {
        where: { status: "active" },
        select: { id: true, label: true, city: true, region: true, instructions: true, isDefault: true },
        orderBy: [{ isDefault: "desc" }, { label: "asc" }],
      },
      fulfillmentDeliveryZones: {
        where: { status: "active" },
        select: { id: true, name: true, city: true, region: true, deliveryFeeAmount: true, estimatedMinutes: true },
        orderBy: { name: "asc" },
      },
      fulfillmentTimeSlots: {
        where: { status: "active" },
        select: { id: true, label: true, dayOfWeek: true, startTime: true, endTime: true, slotType: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      },
    },
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
        headline="Restaurant partner serving public menu items for pickup or delivery requests."
        location={restaurant.countryCode}
        initials={initialsFromName(restaurant.name)}
        badges={sellerBadges.map((badge) => <SellerVerificationBadge key={`seller-verification-${badge.label}`} label={badge.label} tone={badge.tone} />)}
        actions={
          <div className="flex flex-wrap gap-2">
            {menuItems.some((item) => item.status === "active") ? (
              <Button asChild><Link href="#menu">Place my order</Link></Button>
            ) : null}
            <ContactActions href="/orders" label="View my orders" />
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ProfileSection title="Hours and ordering windows">
          {restaurant.fulfillmentTimeSlots.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">This restaurant has not listed opening hours yet.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {restaurant.fulfillmentTimeSlots.map((slot) => (
                <div key={slot.id} className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
                  <p className="font-semibold text-[var(--color-ink)]">{dayNames[slot.dayOfWeek] ?? "Day"}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</p>
                  <Badge tone="info">{slot.slotType.replaceAll("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </ProfileSection>

        <ProfileSection title="Pickup and delivery">
          <div className="mt-4 grid gap-3">
            {restaurant.fulfillmentPickupLocations.length === 0 && restaurant.fulfillmentDeliveryZones.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Pickup and delivery details are not listed yet.</p>
            ) : null}
            {restaurant.fulfillmentPickupLocations.map((location) => (
              <div key={location.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--color-ink)]">{location.label}</p>
                  {location.isDefault ? <Badge tone="success">Default pickup</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{[location.city, location.region].filter(Boolean).join(", ")}</p>
                {location.instructions ? <p className="mt-2 text-sm text-[var(--color-muted)]">{location.instructions}</p> : null}
              </div>
            ))}
            {restaurant.fulfillmentDeliveryZones.map((zone) => (
              <div key={zone.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                <p className="font-semibold text-[var(--color-ink)]">{zone.name}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {[zone.city, zone.region].filter(Boolean).join(", ") || "Delivery zone"} · Fee {zone.deliveryFeeAmount === 0 ? "free" : `$${zone.deliveryFeeAmount.toFixed(2)}`}
                  {zone.estimatedMinutes ? ` · about ${zone.estimatedMinutes} min` : ""}
                </p>
              </div>
            ))}
          </div>
        </ProfileSection>
      </div>
      <ProfileSection title="Social links">
        <SocialLinksRow links={socialLinks} />
      </ProfileSection>
      <RatingSummary averageRating={reviewSummary.averageRating} ratingCount={reviewSummary.ratingCount} />
      <MenuPreviewSection>
        <div id="menu" className="scroll-mt-24" />
        {restaurant.menus.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {restaurant.menus.map((menu) => (
              <Badge key={menu.id} tone="info">{menu.name} · {menu._count.items} item{menu._count.items === 1 ? "" : "s"}</Badge>
            ))}
          </div>
        ) : null}
        {menuItems.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted)]">No active public menu items have been published yet.</p>
        ) : null}
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
