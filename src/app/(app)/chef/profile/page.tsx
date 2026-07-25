import { Badge } from "@/components/ui/badge";
import { UsCityStateSelects } from "@/components/location/us-city-state-selects";
import { ProfileCompletionCard, ProfileHeader, VerificationBadge, initialsFromName } from "@/components/profiles/profile-components";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { BusinessCoverUploader, DocumentUploadField, ImageUploadField } from "@/components/storage/file-upload-field";
import { requireMembership } from "@/lib/auth/session";
import { listRecipes } from "@/server/recipes";
import { canAccessChefMarketplace, getChefProfileForOrganization, isChefBusiness } from "@/server/chefs";
import { listBusinessSocialLinks } from "@/server/business-social-links";
import { listEnabledCountryPhoneOptions } from "@/server/localization/localization-service";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getBusinessProfileCompletion } from "@/server/users/profile";
import { addChefSpecialtyAction, addChefVerificationDocumentAction, deleteChefSocialLinkAction, upsertChefProfileAction, upsertChefSocialLinkAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ChefProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const [session, query] = await Promise.all([requireMembership(), searchParams]);
  const enabled = await canAccessChefMarketplace({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });
  if (!enabled || !isChefBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Chef profile unavailable" description="Chef profile tools are available only for enabled chef business organizations." />;
  }

  const [profile, recipes, socialLinks, phoneOptions] = await Promise.all([
    getChefProfileForOrganization(session.activeOrganization.id),
    listRecipes({ organizationId: session.activeOrganization.id, countryCode: session.activeOrganization.countryCode, publishedOnly: true }),
    listBusinessSocialLinks(session.activeOrganization.id),
    listEnabledCountryPhoneOptions(),
  ]);
  const [profileImageUrl, coverImageUrl] = await Promise.all([
    getStorageImageUrl(session, profile?.profilePhotoFileId, profile?.profilePhotoUrl),
    getStorageImageUrl(session, profile?.coverPhotoFileId),
  ]);
  const completion = profile ? getBusinessProfileCompletion(profile, { services: profile.services.length, socialLinks: socialLinks.length }) : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Chef marketplace"
        title="Chef profile"
        description="Profiles stay private until a platform admin approves and verifies them."
      />
      <FormMessage message={query.message} />

      {profile ? (
        <ProfileHeader
          coverUrl={coverImageUrl}
          avatarUrl={profileImageUrl}
          name={profile.displayName}
          headline={profile.bio}
          location={profile.baseCity ? `${profile.baseCity}${profile.baseRegion ? `, ${profile.baseRegion}` : ""}` : session.activeOrganization.countryCode}
          initials={initialsFromName(profile.displayName)}
          badges={[
            <Badge key="status" tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</Badge>,
            <VerificationBadge key="verification" status={profile.verificationStatus} />,
            <Badge key="public" tone={profile.isPublic ? "success" : "neutral"}>{profile.isPublic ? "Public" : "Hidden"}</Badge>,
          ]}
        />
      ) : null}

      <form action={upsertChefProfileAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Profile details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Display name" name="displayName" defaultValue={profile?.displayName ?? ""} required />
            <TextInput label="Legacy profile photo URL fallback" name="profilePhotoUrl" defaultValue={profile?.profilePhotoUrl ?? ""} />
            <ImageUploadField className="min-h-[86px]" label="Profile photo" name="profilePhotoFileId" module="home_chefs" purpose="business_profile_photo" visibility="public" entityType="chef_profile" entityId={profile?.id} defaultFileId={profile?.profilePhotoFileId ?? null} />
            <BusinessCoverUploader className="min-h-[86px]" label="Cover photo" name="coverPhotoFileId" module="home_chefs" entityType="chef_profile" entityId={profile?.id} defaultFileId={profile?.coverPhotoFileId ?? null} />
            <TextInput label="Languages" name="languages" defaultValue={Array.isArray(profile?.languages) ? profile.languages.join(", ") : ""} hint="Comma-separated, e.g. English, Urdu, Hindi" />
            <TextInput label="Specialties" name="specialties" defaultValue={Array.isArray(profile?.specialties) ? profile.specialties.join(", ") : ""} hint="Comma-separated dish/service specialties" />
            <TextInput label="Years experience" name="yearsExperience" type="number" min={0} defaultValue={profile?.yearsExperience ?? ""} />
            <TextInput label="Service radius km" name="serviceRadiusKm" type="number" min={0} defaultValue={profile?.serviceRadiusKm ?? ""} />
            <UsCityStateSelects defaultCity={profile?.baseCity} defaultState={profile?.baseRegion} />
            <TextInput label="Zip code" name="postalCode" defaultValue={profile?.postalCode ?? ""} />
            <PhoneNumberInput
              defaultValue={profile?.phone}
              defaultCountryCode={phoneOptions.find((option) => option.countryCode === session.activeOrganization.countryCode)?.phoneCountryCode}
              defaultCountryIso={session.activeOrganization.countryCode}
              options={phoneOptions}
            />
            <TextInput label="Email" name="email" type="email" defaultValue={profile?.email ?? ""} />
          </div>
          <TextArea label="Bio" name="bio" defaultValue={profile?.bio ?? ""} required />
        </Card>

        <div className="space-y-6">
          <ProfileCompletionCard score={completion} />
          <Card className="space-y-4">
            <h2 className="font-semibold text-[var(--color-ink)]">Review workflow</h2>
            <p className="text-sm text-[var(--color-muted)]">Submitting asks admins to review. You cannot approve or verify your own profile.</p>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input type="checkbox" name="submitForVerification" />
              Submit for verification
            </label>
            <Button type="submit" className="w-full justify-center">Save profile</Button>
          </Card>
        </div>
      </form>

      {profile ? (
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Specialty dishes</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {profile.specialtyRecipes.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                <p className="font-semibold text-[var(--color-ink)]">{item.dishName}</p>
                {item.notes ? <p className="mt-2 text-sm text-[var(--color-muted)]">{item.notes}</p> : null}
              </div>
            ))}
          </div>
          <form action={addChefSpecialtyAction} className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <select name="recipeId" className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
              <option value="">No linked recipe</option>
              {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
            </select>
            <TextInput label="Dish name" name="dishName" required />
            <TextInput label="Notes" name="notes" />
            <div className="flex items-end"><Button type="submit">Add</Button></div>
          </form>
        </Card>
      ) : null}

      {profile ? (
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Verification documents</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {profile.verificationDocuments.map((document) => (
              <div key={document.id} className="rounded-2xl border border-[var(--color-border)] p-4 text-sm">
                <p className="font-semibold text-[var(--color-ink)]">{document.documentType}</p>
                <p className="mt-1 text-[var(--color-muted)]">{document.status} · {document.fileId ?? "No file"}</p>
              </div>
            ))}
          </div>
          <form action={addChefVerificationDocumentAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <TextInput label="Document type" name="documentType" defaultValue="business_license" />
            <DocumentUploadField label="Private document" name="verificationDocumentFileId" module="home_chefs" purpose="verification_document" visibility="private" entityType="chef_verification_document" entityId={profile.id} />
            <div className="flex items-end"><Button type="submit">Add document</Button></div>
          </form>
        </Card>
      ) : null}

      <SocialLinksManager
        links={socialLinks}
        profileType="chef_business"
        upsertAction={upsertChefSocialLinkAction}
        deleteAction={deleteChefSocialLinkAction}
      />
    </div>
  );
}
import { SocialLinksManager } from "@/components/business-social-links/social-link-components";
