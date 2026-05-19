import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { listRecipes } from "@/server/recipes";
import { canAccessChefMarketplace, getChefProfileForOrganization, isChefBusiness } from "@/server/chefs";
import { listBusinessSocialLinks } from "@/server/business-social-links";
import { addChefSpecialtyAction, deleteChefSocialLinkAction, upsertChefProfileAction, upsertChefSocialLinkAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ChefProfilePage() {
  const session = await requireMembership();
  const enabled = await canAccessChefMarketplace({
    organizationId: session.activeOrganization.id,
    platformRole: session.user.platformRole,
  });
  if (!enabled || !isChefBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Chef profile unavailable" description="Chef profile tools are available only for enabled chef business organizations." />;
  }

  const [profile, recipes, socialLinks] = await Promise.all([
    getChefProfileForOrganization(session.activeOrganization.id),
    listRecipes({ organizationId: session.activeOrganization.id, countryCode: session.activeOrganization.countryCode, publishedOnly: true }),
    listBusinessSocialLinks(session.activeOrganization.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Chef marketplace"
        title="Chef profile"
        description="Profiles stay private until a platform admin approves and verifies them."
      />

      {profile ? (
        <div className="flex flex-wrap gap-2">
          <Badge tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</Badge>
          <Badge tone={profile.verificationStatus === "verified" ? "success" : "warning"}>{profile.verificationStatus}</Badge>
          <Badge tone={profile.isPublic ? "success" : "neutral"}>{profile.isPublic ? "Public" : "Hidden"}</Badge>
        </div>
      ) : null}

      <form action={upsertChefProfileAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-5">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Profile details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Display name" name="displayName" defaultValue={profile?.displayName ?? ""} required />
            <TextInput label="Profile photo URL" name="profilePhotoUrl" defaultValue={profile?.profilePhotoUrl ?? ""} />
            <TextInput label="Languages" name="languages" defaultValue={Array.isArray(profile?.languages) ? profile.languages.join(", ") : ""} hint="Comma-separated, e.g. English, Urdu, Hindi" />
            <TextInput label="Specialties" name="specialties" defaultValue={Array.isArray(profile?.specialties) ? profile.specialties.join(", ") : ""} hint="Comma-separated dish/service specialties" />
            <TextInput label="Years experience" name="yearsExperience" type="number" min={0} defaultValue={profile?.yearsExperience ?? ""} />
            <TextInput label="Service radius km" name="serviceRadiusKm" type="number" min={0} defaultValue={profile?.serviceRadiusKm ?? ""} />
            <TextInput label="Base city" name="baseCity" defaultValue={profile?.baseCity ?? ""} />
            <TextInput label="Base region" name="baseRegion" defaultValue={profile?.baseRegion ?? ""} />
            <TextInput label="Postal code" name="postalCode" defaultValue={profile?.postalCode ?? ""} />
            <TextInput label="Phone" name="phone" defaultValue={profile?.phone ?? ""} />
            <TextInput label="Email" name="email" type="email" defaultValue={profile?.email ?? ""} />
          </div>
          <TextArea label="Bio" name="bio" defaultValue={profile?.bio ?? ""} required />
        </Card>

        <div className="space-y-6">
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
