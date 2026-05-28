import { SocialLinksManager } from "@/components/business-social-links/social-link-components";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { ProfileCompletionCard, ProfileHeader, initialsFromName } from "@/components/profiles/profile-components";
import { BusinessCoverUploader, ImageUploadField } from "@/components/storage/file-upload-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listBusinessSocialLinks } from "@/server/business-social-links";
import { getGoogleMapsPublicConfig } from "@/server/maps/google-maps-config";
import { getPrimaryLocation } from "@/server/maps/location-service";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getBusinessProfileCompletion } from "@/server/users/profile";
import {
  deleteRestaurantSocialLinkAction,
  updateRestaurantProfileBasicsAction,
  updateRestaurantLocationAction,
  updateRestaurantMediaAction,
  upsertRestaurantSocialLinkAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function RestaurantProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const [session, query] = await Promise.all([requireMembership(), searchParams]);
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Restaurant profile tools are available only for restaurant organizations." />;
  }
  const [socialLinks, logoUrl, coverUrl, menuItemCount, mapsConfig, primaryLocation] = await Promise.all([
    listBusinessSocialLinks(session.activeOrganization.id),
    getStorageImageUrl(session, session.activeOrganization.logoFileId),
    getStorageImageUrl(session, session.activeOrganization.coverPhotoFileId),
    prisma.menuItem.count({ where: { organizationId: session.activeOrganization.id } }),
    getGoogleMapsPublicConfig(session.activeOrganization.countryCode),
    getPrimaryLocation("organization", session.activeOrganization.id),
  ]);
  const completion = getBusinessProfileCompletion({
    logoFileId: session.activeOrganization.logoFileId,
    coverPhotoFileId: session.activeOrganization.coverPhotoFileId,
    bio: "Restaurant partner profile",
  }, { menuItems: menuItemCount, socialLinks: socialLinks.length });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Restaurant"
        title="Restaurant profile"
        description="Manage the public profile basics households see when browsing your menu. Detailed restaurant profiles stay intentionally lightweight in this beta."
      />
      <FormMessage message={query.message} />
      <ProfileHeader
        coverUrl={coverUrl}
        avatarUrl={logoUrl}
        name={session.activeOrganization.name}
        headline="Restaurant partner profile for public menu browsing and manual order requests."
        location={session.activeOrganization.countryCode}
        initials={initialsFromName(session.activeOrganization.name)}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <form action={updateRestaurantProfileBasicsAction} className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Restaurant details</h2>
            <p className="text-sm text-[var(--color-muted)]">
              Update the restaurant name shown across menus, orders, and public restaurant browsing.
            </p>
            <TextInput label="Restaurant name" name="name" defaultValue={session.activeOrganization.name} required />
            <Button type="submit">Save restaurant details</Button>
          </form>
        </Card>
        <Card>
          <form action={updateRestaurantMediaAction} className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Restaurant images</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <ImageUploadField label="Logo / profile image" name="logoFileId" module="restaurants" purpose="business_profile_photo" visibility="public" entityType="organization" entityId={session.activeOrganization.id} defaultFileId={session.activeOrganization.logoFileId ?? null} />
              <BusinessCoverUploader label="Cover image" name="coverPhotoFileId" module="restaurants" entityType="organization" entityId={session.activeOrganization.id} defaultFileId={session.activeOrganization.coverPhotoFileId ?? null} />
            </div>
            <Button type="submit">Save images</Button>
          </form>
        </Card>
        <Card>
          <form action={updateRestaurantLocationAction} className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Restaurant location</h2>
            <LocationPicker
              label="Primary restaurant address"
              mapsConfig={mapsConfig}
              hint="This stays private unless a future restaurant profile setting explicitly exposes more than city-level detail."
              fieldNames={{
                addressLine1: "addressLine1",
                addressLine2: "addressLine2",
                city: "city",
                region: "region",
                countryCode: "locationCountryCode",
                postalCode: "postalCode",
                latitude: "locationLatitude",
                longitude: "locationLongitude",
                providerPlaceId: "locationProviderPlaceId",
              }}
              defaultValue={{
                addressLine1: primaryLocation?.addressLine1 ?? null,
                addressLine2: primaryLocation?.addressLine2 ?? null,
                city: primaryLocation?.city ?? null,
                region: primaryLocation?.region ?? null,
                countryCode: primaryLocation?.countryCode ?? session.activeOrganization.countryCode,
                postalCode: primaryLocation?.postalCode ?? null,
                latitude: primaryLocation?.latitude ?? null,
                longitude: primaryLocation?.longitude ?? null,
                providerPlaceId: primaryLocation?.providerPlaceId ?? null,
              }}
            />
            <Button type="submit">Save location</Button>
          </form>
        </Card>
        <ProfileCompletionCard score={completion} />
      </div>
      <SocialLinksManager
        links={socialLinks}
        profileType="restaurant"
        upsertAction={upsertRestaurantSocialLinkAction}
        deleteAction={deleteRestaurantSocialLinkAction}
      />
    </div>
  );
}
