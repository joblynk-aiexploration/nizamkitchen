import { SocialLinksManager } from "@/components/business-social-links/social-link-components";
import { ProfileCompletionCard, ProfileHeader, initialsFromName } from "@/components/profiles/profile-components";
import { BusinessCoverUploader, ImageUploadField } from "@/components/storage/file-upload-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listBusinessSocialLinks } from "@/server/business-social-links";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getBusinessProfileCompletion } from "@/server/users/profile";
import { deleteRestaurantSocialLinkAction, updateRestaurantMediaAction, upsertRestaurantSocialLinkAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RestaurantProfilePage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Restaurant profile tools are available only for restaurant organizations." />;
  }
  const [socialLinks, logoUrl, coverUrl, menuItemCount] = await Promise.all([
    listBusinessSocialLinks(session.activeOrganization.id),
    getStorageImageUrl(session, session.activeOrganization.logoFileId),
    getStorageImageUrl(session, session.activeOrganization.coverPhotoFileId),
    prisma.menuItem.count({ where: { organizationId: session.activeOrganization.id } }),
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
          <form action={updateRestaurantMediaAction} className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Restaurant images</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <ImageUploadField label="Logo / profile image" name="logoFileId" module="restaurants" purpose="business_profile_photo" visibility="public" entityType="organization" entityId={session.activeOrganization.id} defaultFileId={session.activeOrganization.logoFileId ?? null} />
              <BusinessCoverUploader label="Cover image" name="coverPhotoFileId" module="restaurants" entityType="organization" entityId={session.activeOrganization.id} defaultFileId={session.activeOrganization.coverPhotoFileId ?? null} />
            </div>
            <Button type="submit">Save images</Button>
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
