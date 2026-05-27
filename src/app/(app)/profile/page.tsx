import Link from "next/link";
import { Building2, Globe2, Languages, Mail, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileCompletionCard, ProfileHeader, ProfileSection, ProfileStatCard, initialsFromName } from "@/components/profiles/profile-components";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatReligion } from "@/lib/religion";
import { getPrimaryLocation } from "@/server/maps/location-service";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getUserOAuthAvatarImageUrl, getUserProfileCompletion } from "@/server/users/profile";

export const dynamic = "force-dynamic";

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
      <dt className="flex items-center gap-3 text-sm font-semibold text-[var(--color-ink)]">
        <span className="rounded-xl bg-slate-50 p-2 text-[var(--color-primary)] ring-1 ring-slate-200">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm text-[var(--color-muted)] [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

export default async function ProfileShortcutPage() {
  const session = await requireUser();
  const [user, primaryLocation] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        memberships: { include: { organization: true }, take: 8 },
        countryAssignments: { include: { country: true } },
      },
    }),
    getPrimaryLocation("user", session.user.id),
  ]);

  if (!user) return null;

  const [oauthAvatarUrl, coverUrl] = await Promise.all([
    getUserOAuthAvatarImageUrl(user.id),
    getStorageImageUrl(session, user.coverPhotoFileId),
  ]);
  const avatarUrl = await getStorageImageUrl(session, user.profilePhotoFileId, oauthAvatarUrl);
  const location = user.locationText ?? user.location ?? [primaryLocation?.city, primaryLocation?.region].filter(Boolean).join(", ");
  const completion = getUserProfileCompletion({ ...user, oauthAvatarUrl });
  const address = primaryLocation
    ? [
        primaryLocation.addressLine1,
        primaryLocation.addressLine2,
        [primaryLocation.city, primaryLocation.region, primaryLocation.postalCode].filter(Boolean).join(", "),
        primaryLocation.countryCode,
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-8">
      <ProfileHeader
        coverUrl={coverUrl}
        avatarUrl={avatarUrl}
        name={user.fullName}
        headline={user.headline ?? "Manage your kitchen identity, contact details, family workspace, and profile visibility from one clean place."}
        location={location}
        initials={initialsFromName(user.fullName)}
        badges={[
          <Badge key="status" tone={user.status === "active" ? "success" : "warning"}>{user.status}</Badge>,
          user.platformRole ? <Badge key="role" tone="info">{user.platformRole.replace(/_/g, " ")}</Badge> : <Badge key="member" tone="neutral">Member</Badge>,
          <Badge key="visibility" tone={user.publicProfileEnabled ? "success" : "neutral"}>{user.publicProfileEnabled ? "Public profile on" : "Private profile"}</Badge>,
        ]}
        actions={
          <>
            <Button asChild><Link href="/settings/profile">Edit profile</Link></Button>
            <Button asChild variant="secondary"><Link href="/settings/preferences">Preferences</Link></Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <ProfileStatCard label="Organizations" value={user.memberships.length} />
        <ProfileStatCard label="Countries" value={user.countryAssignments.length} />
        <ProfileStatCard label="Completion" value={`${completion}%`} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ProfileSection
            title="About"
            action={<Button asChild variant="ghost"><Link href="/settings/profile">Update bio</Link></Button>}
          >
            <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-slate-50 p-5 ring-1 ring-emerald-100">
              <p className="text-sm leading-7 text-slate-700">
                {user.bio || "Add a short bio so other NizamKitchen members understand your household, cooking interests, and preferences."}
              </p>
            </div>
          </ProfileSection>

          <ProfileSection
            title="Organizations"
            action={<Badge tone="info">{user.memberships.length} linked</Badge>}
          >
            {user.memberships.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {user.memberships.map((membership) => (
                  <div key={membership.id} className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="rounded-2xl bg-slate-950 p-3 text-white">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--color-ink)]">{membership.organization.name}</p>
                        <p className="mt-1 text-sm text-[var(--color-muted)]">
                          {membership.organization.organizationType.replace(/_/g, " ")} · {membership.role.replace(/_/g, " ")}
                        </p>
                        <Badge tone={membership.status === "active" ? "success" : "warning"}>{membership.status}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No organizations are attached to this account yet.</p>
            )}
          </ProfileSection>
        </div>

        <div className="space-y-6">
          <ProfileCompletionCard score={completion} />
          <ProfileSection title="Personal information">
            <dl className="grid gap-3">
              <InfoRow icon={Mail} label="Email" value={user.email} />
              <InfoRow icon={Phone} label="Phone" value={user.phone || "Not provided"} />
              <InfoRow icon={Sparkles} label="Religion" value={formatReligion(user.religion)} />
              <InfoRow icon={Languages} label="Language" value={user.preferredLanguage || "Not provided"} />
              <InfoRow icon={ShieldCheck} label="Visibility" value={user.publicProfileEnabled ? "Public profile on" : "Private profile"} />
            </dl>
          </ProfileSection>
          <ProfileSection title="Address">
            {address.length ? (
              <div className="rounded-3xl border border-[var(--color-border)] bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
                  <MapPin className="h-4 w-4 text-[var(--color-primary)]" />
                  Primary address
                </div>
                <address className="not-italic text-sm leading-6 text-[var(--color-muted)]">
                  {address.map((line) => <span key={line} className="block">{line}</span>)}
                </address>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No address has been added yet.</p>
            )}
          </ProfileSection>
          <ProfileSection title="Country access">
            {user.countryAssignments.length ? (
              <div className="grid gap-2">
                {user.countryAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-[var(--color-muted)]">
                    <Globe2 className="h-4 w-4 text-[var(--color-primary)]" />
                    {assignment.country.countryName}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No direct country assignments.</p>
            )}
          </ProfileSection>
        </div>
      </div>
    </div>
  );
}
