import { SocialLinksManager } from "@/components/business-social-links/social-link-components";
import { BusinessCoverUploader, ImageUploadField } from "@/components/storage/file-upload-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listBusinessSocialLinks } from "@/server/business-social-links";
import { deleteRestaurantSocialLinkAction, updateRestaurantMediaAction, upsertRestaurantSocialLinkAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RestaurantProfilePage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Restaurant profile tools are available only for restaurant organizations." />;
  }
  const socialLinks = await listBusinessSocialLinks(session.activeOrganization.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Restaurant"
        title="Restaurant profile"
        description="Manage the public profile basics households see when browsing your menu. Detailed restaurant profiles stay intentionally lightweight in this beta."
      />
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">{session.activeOrganization.name}</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Public restaurant pages show active public menu items and public social links. Exact ordering, payment, and delivery integrations are not connected.
        </p>
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
      <SocialLinksManager
        links={socialLinks}
        profileType="restaurant"
        upsertAction={upsertRestaurantSocialLinkAction}
        deleteAction={deleteRestaurantSocialLinkAction}
      />
    </div>
  );
}
