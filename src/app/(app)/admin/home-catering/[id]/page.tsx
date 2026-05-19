import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSocialLinks } from "@/components/business-social-links/social-link-components";
import { ProfileCompletionCard, ProfileHeader, VerificationBadge, initialsFromName } from "@/components/profiles/profile-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { listBusinessSocialLinks } from "@/server/business-social-links";
import { getAdminHomeCateringProfile } from "@/server/home-catering";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getBusinessProfileCompletion } from "@/server/users/profile";
import { moderateDeleteBusinessSocialLinkAction } from "../../business-social-links/actions";
import { updateAdminHomeCateringProfileAction } from "../actions";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "suspended", label: "Suspended" },
  { value: "disabled", label: "Disabled" },
];

const verificationOptions = [
  { value: "unverified", label: "Unverified" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

export default async function AdminHomeCateringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const profile = await getAdminHomeCateringProfile(session, id).catch(() => null);
  if (!profile) notFound();
  const [socialLinks, avatarUrl, coverUrl, menuCount] = await Promise.all([
    listBusinessSocialLinks(profile.organizationId),
    getStorageImageUrl(session, profile.profilePhotoFileId, profile.profilePhotoUrl),
    getStorageImageUrl(session, profile.coverPhotoFileId, profile.coverPhotoUrl),
    prisma.menuItem.count({ where: { organizationId: profile.organizationId } }),
  ]);
  const completion = getBusinessProfileCompletion(profile, { menuItems: menuCount, socialLinks: socialLinks.length });
  const canMutate = session.user.platformRole !== "auditor";

  return (
    <AdminShell session={session} title={profile.displayName} description={`${profile.organization.name} · ${profile.countryCode}`}>
      <ProfileHeader
        coverUrl={coverUrl}
        avatarUrl={avatarUrl}
        name={profile.displayName}
        headline={profile.bio ?? "Home catering seller"}
        location={profile.city ? `${profile.city}${profile.region ? `, ${profile.region}` : ""}` : profile.countryCode}
        initials={initialsFromName(profile.displayName)}
        badges={[<VerificationBadge key="verification" status={profile.verificationStatus} />, <Badge key="status" tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</Badge>]}
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone={profile.status === "active" ? "success" : "warning"}>{profile.status}</Badge>
        <Badge tone={profile.verificationStatus === "verified" ? "success" : "warning"}>{profile.verificationStatus}</Badge>
        <Badge tone={profile.isPublic ? "success" : "neutral"}>{profile.isPublic ? "Public" : "Hidden"}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Profile</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{profile.bio || "No bio yet."}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Info label="Owner" value={profile.ownerName} />
              <Info label="City" value={profile.city} />
              <Info label="Region" value={profile.region} />
              <Info label="Service area" value={profile.serviceAreaText} />
              <Info label="Phone" value={profile.phone} />
              <Info label="Email" value={profile.email} />
              <Info label="Minimum notice" value={profile.minimumNoticeHours ? `${profile.minimumNoticeHours} hours` : null} />
              <Info label="Fulfillment" value={[profile.acceptsPickup ? "Pickup" : null, profile.acceptsDelivery ? "Delivery" : null, profile.acceptsPreorders ? "Preorder" : null].filter(Boolean).join(", ")} />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Specialties and languages</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Info label="Specialties" value={Array.isArray(profile.cuisineSpecialtiesJson) ? profile.cuisineSpecialtiesJson.join(", ") : null} />
              <Info label="Languages" value={Array.isArray(profile.languagesJson) ? profile.languagesJson.join(", ") : null} />
            </div>
          </Card>

          <AdminSocialLinks links={socialLinks} deleteAction={moderateDeleteBusinessSocialLinkAction} />
        </div>

        <div className="space-y-6">
          <ProfileCompletionCard score={completion} />
          {canMutate ? (
            <Card className="space-y-4">
              <h2 className="font-semibold text-[var(--color-ink)]">Admin controls</h2>
              <form action={updateAdminHomeCateringProfileAction} className="space-y-3">
                <input type="hidden" name="profileId" value={profile.id} />
                <SelectInput label="Status" name="status" defaultValue={profile.status} options={statusOptions} />
                <SelectInput label="Verification" name="verificationStatus" defaultValue={profile.verificationStatus} options={verificationOptions} />
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
                  <input type="checkbox" name="isPublic" defaultChecked={profile.isPublic} />
                  Public listing
                </label>
                <TextArea label="Internal admin notes" name="adminNotes" defaultValue={profile.adminNotes ?? ""} />
                <Button type="submit" className="w-full justify-center">Save controls</Button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--color-ink)]">{value || "Not provided"}</p>
    </div>
  );
}
