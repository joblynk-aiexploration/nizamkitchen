import { Badge } from "@/components/ui/badge";
import { ProfileCompletionCard, ProfileHeader, VerificationBadge, initialsFromName } from "@/components/profiles/profile-components";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { BusinessCoverUploader, ImageUploadField } from "@/components/storage/file-upload-field";
import { requireMembership } from "@/lib/auth/session";
import {
  canAccessHomeCatering,
  getHomeCateringProfileForOrganization,
  isHomeCateringBusiness,
} from "@/server/home-catering";
import { listBusinessSocialLinks } from "@/server/business-social-links";
import { prisma } from "@/lib/prisma";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getBusinessProfileCompletion } from "@/server/users/profile";
import { deleteCateringSocialLinkAction, upsertCateringSocialLinkAction, upsertHomeCateringProfileAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CateringProfilePage() {
  const session = await requireMembership();
  const enabled = await canAccessHomeCatering({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });

  if (!enabled || !isHomeCateringBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Home catering profile unavailable" description="Profile tools are available only for enabled home catering organizations." />;
  }

  const [profile, socialLinks] = await Promise.all([
    getHomeCateringProfileForOrganization(session.activeOrganization.id),
    listBusinessSocialLinks(session.activeOrganization.id),
  ]);
  const [profileImageUrl, coverImageUrl, menuItemCount] = await Promise.all([
    getStorageImageUrl(session, profile?.profilePhotoFileId, profile?.profilePhotoUrl),
    getStorageImageUrl(session, profile?.coverPhotoFileId, profile?.coverPhotoUrl),
    prisma.menuItem.count({ where: { organizationId: session.activeOrganization.id } }),
  ]);
  const completion = profile ? getBusinessProfileCompletion(profile, { menuItems: menuItemCount, socialLinks: socialLinks.length }) : 0;
  const specialties = Array.isArray(profile?.cuisineSpecialtiesJson) ? profile.cuisineSpecialtiesJson.join(", ") : "";
  const languages = Array.isArray(profile?.languagesJson) ? profile.languagesJson.join(", ") : "";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home catering"
        title="Seller profile"
        description="Share city-level service details only. Exact home addresses stay private until a future explicit seller workflow is built."
      />

      {profile ? (
        <ProfileHeader
          coverUrl={coverImageUrl}
          avatarUrl={profileImageUrl}
          name={profile.displayName}
          headline={profile.bio}
          location={profile.city ? `${profile.city}${profile.region ? `, ${profile.region}` : ""}` : session.activeOrganization.countryCode}
          initials={initialsFromName(profile.displayName)}
          badges={[
            <Badge key="status" tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</Badge>,
            <VerificationBadge key="verification" status={profile.verificationStatus} />,
            <Badge key="public" tone={profile.isPublic ? "success" : "neutral"}>{profile.isPublic ? "Public" : "Hidden"}</Badge>,
          ]}
        />
      ) : null}

      <form action={upsertHomeCateringProfileAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Business details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Display name" name="displayName" defaultValue={profile?.displayName ?? session.activeOrganization.name} required />
            <TextInput label="Owner name" name="ownerName" defaultValue={profile?.ownerName ?? ""} />
            <ImageUploadField label="Profile photo" name="profilePhotoFileId" module="home_catering" purpose="business_profile_photo" visibility="public" entityType="home_catering_profile" entityId={profile?.id} defaultFileId={profile?.profilePhotoFileId ?? null} />
            <BusinessCoverUploader label="Cover photo" name="coverPhotoFileId" module="home_catering" entityType="home_catering_profile" entityId={profile?.id} defaultFileId={profile?.coverPhotoFileId ?? null} />
            <TextInput label="Legacy profile photo URL fallback" name="profilePhotoUrl" defaultValue={profile?.profilePhotoUrl ?? ""} />
            <TextInput label="Legacy cover photo URL fallback" name="coverPhotoUrl" defaultValue={profile?.coverPhotoUrl ?? ""} />
            <TextInput label="Cuisine specialties" name="cuisineSpecialties" defaultValue={specialties} hint="Comma-separated, e.g. biryani, haleem, sweets" />
            <TextInput label="Languages" name="languages" defaultValue={languages} hint="Comma-separated, e.g. English, Urdu, Hindi" />
            <TextInput label="City" name="city" defaultValue={profile?.city ?? ""} />
            <TextInput label="Region" name="region" defaultValue={profile?.region ?? ""} />
            <TextInput label="Postal code" name="postalCode" defaultValue={profile?.postalCode ?? ""} />
            <TextInput label="Phone" name="phone" defaultValue={profile?.phone ?? ""} />
            <TextInput label="Email" name="email" type="email" defaultValue={profile?.email ?? ""} />
            <TextInput label="Minimum notice hours" name="minimumNoticeHours" type="number" min={0} defaultValue={profile?.minimumNoticeHours ?? ""} />
          </div>
          <TextArea label="Bio" name="bio" defaultValue={profile?.bio ?? ""} />
          <TextArea label="Service area notes" name="serviceAreaText" defaultValue={profile?.serviceAreaText ?? ""} />
        </Card>

        <div className="space-y-6">
          <ProfileCompletionCard score={completion} />
          <Card className="space-y-4">
            <h2 className="font-semibold text-[var(--color-ink)]">Fulfillment options</h2>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input type="checkbox" name="acceptsPickup" defaultChecked={profile?.acceptsPickup ?? true} />
              Accept pickup
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input type="checkbox" name="acceptsDelivery" defaultChecked={profile?.acceptsDelivery ?? false} />
              Accept delivery
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input type="checkbox" name="acceptsPreorders" defaultChecked={profile?.acceptsPreorders ?? true} />
              Accept preorders
            </label>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold text-[var(--color-ink)]">Review workflow</h2>
            <p className="text-sm text-[var(--color-muted)]">Submitting asks platform admins to review. Sellers cannot approve or verify their own profiles.</p>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input type="checkbox" name="submitForVerification" />
              Submit for verification
            </label>
            <Button type="submit" className="w-full justify-center">Save profile</Button>
          </Card>
        </div>
      </form>

      <SocialLinksManager
        links={socialLinks}
        profileType="home_catering"
        upsertAction={upsertCateringSocialLinkAction}
        deleteAction={deleteCateringSocialLinkAction}
      />
    </div>
  );
}
import { SocialLinksManager } from "@/components/business-social-links/social-link-components";
