import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileCompletionCard, ProfileHeader, ProfileSection, ProfileStatCard, initialsFromName } from "@/components/profiles/profile-components";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getUserProfileCompletion } from "@/server/users/profile";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;
  const isOwnProfile = session.user.id === id;
  const canAdminView = Boolean(session.user.platformRole);
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      memberships: { include: { organization: true }, take: 8 },
      countryAssignments: { include: { country: true } },
    },
  });
  if (!user) notFound();
  if (!isOwnProfile && !canAdminView && !user.publicProfileEnabled) notFound();

  const [avatarUrl, coverUrl] = await Promise.all([
    getStorageImageUrl(session, user.profilePhotoFileId),
    getStorageImageUrl(session, user.coverPhotoFileId),
  ]);
  const completion = getUserProfileCompletion(user);
  const location = user.locationText ?? user.location;

  return (
    <div className="space-y-8">
      <ProfileHeader
        coverUrl={coverUrl}
        avatarUrl={avatarUrl}
        name={user.fullName}
        headline={user.headline ?? user.platformRole ?? "NizamKitchen member"}
        location={location}
        initials={initialsFromName(user.fullName)}
        badges={[
          <Badge key="status" tone={user.status === "active" ? "success" : "warning"}>{user.status}</Badge>,
          user.platformRole ? <Badge key="role" tone="info">{user.platformRole.replace(/_/g, " ")}</Badge> : <Badge key="member" tone="neutral">Member</Badge>,
        ]}
        actions={isOwnProfile ? <Button asChild><Link href="/profile/edit">Edit profile</Link></Button> : null}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <ProfileStatCard label="Organizations" value={user.memberships.length} />
        <ProfileStatCard label="Countries" value={user.countryAssignments.length} />
        <ProfileStatCard label="Visibility" value={user.publicProfileEnabled ? "Public" : "Private"} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ProfileSection title="About">
            <p className="text-sm leading-6 text-[var(--color-muted)]">{user.bio || "No bio has been added yet."}</p>
          </ProfileSection>

          <ProfileSection title="Organizations">
            <div className="grid gap-3 md:grid-cols-2">
              {user.memberships.map((membership) => (
                <div key={membership.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                  <p className="font-semibold text-[var(--color-ink)]">{membership.organization.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{membership.organization.organizationType.replace(/_/g, " ")} · {membership.role.replace(/_/g, " ")}</p>
                </div>
              ))}
            </div>
          </ProfileSection>
        </div>

        <div className="space-y-6">
          <ProfileCompletionCard score={completion} />
          <ProfileSection title="Contact">
            {isOwnProfile || canAdminView ? (
              <div className="space-y-2 text-sm text-[var(--color-muted)]">
                <p>Email: {user.email}</p>
                <p>Phone: {user.phone || "Not provided"}</p>
                <p>Preferred language: {user.preferredLanguage || "Not provided"}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">Private contact details are hidden.</p>
            )}
          </ProfileSection>
        </div>
      </div>
    </div>
  );
}
