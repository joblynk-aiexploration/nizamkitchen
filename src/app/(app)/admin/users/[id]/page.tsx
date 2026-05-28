import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  Building2,
  Fingerprint,
  Globe2,
  LockKeyhole,
  KeyRound,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDangerZone } from "@/components/admin/admin-danger-zone";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { FormMessage } from "@/components/ui/form-message";
import {
  ProfileCompletionCard,
  ProfileSection,
  initialsFromName,
} from "@/components/profiles/profile-components";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatAppDateTime } from "@/lib/utils";
import { getAdminUserDetail } from "@/server/admin/users";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getUserOAuthAvatarImageUrl, getUserProfileCompletion } from "@/server/users/profile";
import { deleteAdminUserAction } from "../actions";

function formatDateTime(date: Date | null) {
  return formatAppDateTime(date, { showTimeZone: true });
}

function humanize(value?: string | null) {
  return value ? value.replace(/_/g, " ") : "None";
}

function authProviderLabel(provider: string) {
  if (provider === "google") return "Google";
  if (provider === "facebook") return "Facebook";
  return humanize(provider);
}

function authMethodSummary(oauthAccounts: Array<{ provider: string }>) {
  const providers = oauthAccounts.map((account) => authProviderLabel(account.provider));
  return providers.length ? `Email account + ${providers.join(" + ")}` : "Email account";
}

function InfoTile({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-slate-950 p-2.5 text-white">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <div className="mt-1 break-words text-sm font-semibold text-slate-950">{value}</div>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm font-medium text-[var(--color-ink)]">{label}</dt>
      <dd className="text-sm text-[var(--color-muted)]">{value}</dd>
    </div>
  );
}

function HeroMetaPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-slate-100 shadow-sm backdrop-blur">
      <span className="font-semibold text-emerald-100">{label}:</span>{" "}
      <span className="[overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">{description}</p>
    </div>
  );
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const { id } = await params;
  const query = await searchParams;
  const user = await getAdminUserDetail(session, id);
  const [oauthAvatarUrl, coverUrl] = await Promise.all([
    getUserOAuthAvatarImageUrl(user.id),
    getStorageImageUrl(session, user.coverPhotoFileId),
  ]);
  const avatarUrl = await getStorageImageUrl(session, user.profilePhotoFileId, oauthAvatarUrl);
  const completion = getUserProfileCompletion(user);
  const canMutate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";
  const canDelete = session.user.platformRole === "platform_owner";
  const isSelf = user.id === session.user.id;
  const socialAuthLabels = user.oauthAccounts.map((account) => authProviderLabel(account.provider));
  const riskItems = [
    user.status === "active" ? "Account can sign in" : `Account is ${humanize(user.status)}`,
    user.platformRole ? `${humanize(user.platformRole)} platform access` : "No platform admin role",
    user.sessions.length ? `${user.sessions.length} recent session(s)` : "No recent active sessions",
    user.memberships.length ? `${user.memberships.length} organization relationship(s)` : "No organization access",
  ];
  return (
    <AdminShell
      session={session}
      title={user.fullName}
      description="Review identity, permissions, and account activity in a single professional workspace."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/admin/users/${user.id}/permissions`}>Permissions</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/users">Back to users</Link>
          </Button>
        </div>
      }
    >
      <FormMessage message={query.message} />

      <Card className="overflow-hidden p-0">
        <div className="relative min-h-[360px] bg-slate-950">
          {coverUrl ? (
            // Signed/private storage URLs are generated server-side and may not be compatible with Next image optimization.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={`${user.fullName} cover`} className="absolute inset-0 h-full w-full object-cover opacity-35" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.32),transparent_32%),linear-gradient(135deg,#071826,#0f2b3d_45%,#063d39)]" />
          )}
          <div className="relative grid gap-6 p-6 text-white md:p-8 lg:grid-cols-[1fr_380px]">
            <div className="flex min-h-[300px] flex-col justify-center gap-7">
              <div>
                <div className="mb-6 inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  Enterprise user profile
                </div>
                <div className="flex flex-col gap-5 md:flex-row md:items-center">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] border border-white/30 bg-white/15 text-3xl font-semibold shadow-2xl">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={`${user.fullName} profile`} className="h-full w-full object-cover" />
                    ) : (
                      initialsFromName(user.fullName)
                    )}
                  </div>
                  <div>
                    <h1 className="font-serif text-4xl text-white md:text-5xl">{user.fullName}</h1>
                    <p className="mt-3 max-w-3xl text-base leading-7 text-slate-200">
                      {user.headline ?? "NizamKitchen account with platform-managed identity, organization access, sessions, and audit history."}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <RoleBadge value={user.platformRole ?? "member"} />
                      <StatusBadge value={user.status} />
                      {isSelf ? <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">Current user</span> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <HeroMetaPill label="Email" value={user.email} />
                  <HeroMetaPill label="Sign-in" value={authMethodSummary(user.oauthAccounts)} />
                  <HeroMetaPill label="Created" value={formatDateTime(user.createdAt)} />
                </div>
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Access summary</p>
              <div className="mt-4 grid gap-3">
                {riskItems.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 text-sm text-slate-100">
                    <ShieldCheck className="h-4 w-4 text-emerald-200" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-slate-950">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last login</p>
                <p className="mt-1 text-sm font-semibold">{formatDateTime(user.lastLoginAt ?? null)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <SectionHeading
        eyebrow="Overview"
        title="Identity and access posture"
        description="A concise operational view of who this user is, what they can access, and whether their account is ready for normal platform activity."
      />

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ProfileCompletionCard score={completion} />
        <ProfileSection title="Contact and identity">
          <dl className="grid gap-4 text-sm">
            <DetailRow label="Email" value={<span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" />{user.email}</span>} />
            <DetailRow label="Phone" value={<span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{user.phone || "Not set"}</span>} />
            <DetailRow label="Location" value={user.locationText ?? user.location ?? "Not set"} />
            <DetailRow label="Preferred language" value={user.preferredLanguage ?? user.preferredLocale ?? "Not set"} />
            <DetailRow label="Timezone" value={user.preferredTimezone ?? "Not set"} />
            <DetailRow label="Authentication" value={authMethodSummary(user.oauthAccounts)} />
            <DetailRow label="Created" value={formatDateTime(user.createdAt)} />
          </dl>
        </ProfileSection>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <InfoTile icon={Building2} label="Memberships" value={user.memberships.length} helper="Organization relationships" />
        <InfoTile icon={Globe2} label="Country scope" value={user.countryAssignments.length} helper="Direct assignments" />
        <InfoTile icon={Fingerprint} label="Sessions" value={user.sessions.length} helper="Recent active sessions" />
        <InfoTile icon={KeyRound} label="Social login" value={socialAuthLabels.length ? socialAuthLabels.join(", ") : "Email only"} helper="Linked sign-in providers" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <ProfileSection title="Sign-in methods">
          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-950 p-2 text-white">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-ink)]">Email account</p>
                    <p className="text-sm text-[var(--color-muted)]">{user.email}</p>
                  </div>
                </div>
                <StatusBadge value="active" />
              </div>
            </div>
            {user.oauthAccounts.length ? (
              user.oauthAccounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-700">
                        <KeyRound className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--color-ink)]">{authProviderLabel(account.provider)} sign-in</p>
                        <p className="text-sm text-[var(--color-muted)]">
                          {account.email ?? account.displayName ?? "Provider account linked"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--color-muted)]">
                      <p>{account.emailVerified ? "Email verified by provider" : "Provider email not verified"}</p>
                      <p>Linked {formatDateTime(account.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--color-border)] bg-slate-50 px-4 py-3 text-sm text-[var(--color-muted)]">
                No Google or Facebook account is linked. This user uses the standard email sign-in flow.
              </p>
            )}
          </div>
        </ProfileSection>
        <InfoTile icon={ShieldAlert} label="Audit entries" value={user.auditLogs.length} helper="Latest platform events" />
      </section>

      <SectionHeading
        eyebrow="Access"
        title="Organizations, countries, and sessions"
        description="Use this area to understand tenant relationships before changing roles, disabling access, or removing the account."
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <ProfileSection title="Organization access">
          {user.memberships.length ? (
            <div className="grid gap-3">
              {user.memberships.map((membership) => (
                <Link
                  key={membership.id}
                  href={`/admin/organizations/${membership.organization.id}`}
                  className="group rounded-3xl border border-[var(--color-border)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-primary)]">{membership.organization.name}</p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{humanize(membership.organization.organizationType)} · {membership.organization.country?.countryName ?? membership.organization.countryCode}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <RoleBadge value={membership.role} />
                      <StatusBadge value={membership.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">This user has no organization memberships.</p>
          )}
        </ProfileSection>

        <ProfileSection title="Country assignments">
          <div className="space-y-3">
            {user.countryAssignments.length ? (
              user.countryAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3">
                  <CountryBadge
                    countryCode={assignment.country.countryCode}
                    countryName={assignment.country.countryName}
                  />
                  <Globe2 className="h-4 w-4 text-slate-400" />
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No direct country assignments.</p>
            )}
          </div>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Recent sessions</h3>
          <div className="mt-3 space-y-3">
            {user.sessions.length ? (
              user.sessions.map((sessionItem) => (
                <Card key={sessionItem.id} className="rounded-2xl p-3 text-sm">
                  <p className="font-medium text-[var(--color-ink)]">{formatDateTime(sessionItem.createdAt)}</p>
                  <p className="text-[var(--color-muted)]">{sessionItem.ipAddress ?? "IP unknown"}</p>
                </Card>
              ))
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No active sessions found.</p>
            )}
          </div>
        </ProfileSection>
      </section>

      {canMutate ? (
        <>
        <SectionHeading
          eyebrow="Controls"
          title="Administrative actions"
          description="Change account status or role with audit-backed actions. Destructive actions are separated into the danger zone below."
        />
        <Card>
          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr] xl:items-start">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-[var(--color-ink)]">Account controls</h2>
              <p className="text-sm text-[var(--color-muted)]">
                Platform owners and admins can change access state and platform role. All updates are audit logged.
              </p>
            </div>
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2 rounded-3xl bg-slate-50 p-3">
                {[
                  { label: "Activate", value: "active", tone: "secondary" as const },
                  { label: "Suspend", value: "suspended", tone: "danger" as const },
                  { label: "Disable", value: "disabled", tone: "outline" as const },
                ].map((item) => (
                  <form key={item.value} action={`/api/admin/users/${user.id}/status`} method="post" className="inline-flex">
                    <input type="hidden" name="status" value={item.value} />
                    <Button type="submit" variant={item.tone}>
                      {item.label}
                    </Button>
                  </form>
                ))}
              </div>

              <form action={`/api/admin/users/${user.id}/role`} method="post" className="flex flex-col gap-3 rounded-3xl bg-slate-50 p-4 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-sm font-medium text-[var(--color-ink)]">
                  Platform role
                  <select
                    name="platformRole"
                    defaultValue={user.platformRole ?? ""}
                    className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm"
                  >
                    <option value="">none</option>
                    <option value="platform_owner">platform_owner</option>
                    <option value="platform_admin">platform_admin</option>
                    <option value="country_manager">country_manager</option>
                    <option value="support_admin">support_admin</option>
                    <option value="auditor">auditor</option>
                  </select>
                </label>
                <Button type="submit">Update role</Button>
              </form>
            </div>
          </div>
        </Card>
        </>
      ) : null}

      {canDelete && user.id !== session.user.id ? (
        <AdminDangerZone
          title="Remove user from platform access"
          description="This is a safe-delete flow: the user is disabled, sessions and OAuth links are removed, memberships are marked removed, personal profile fields are cleared, and transaction/audit history is preserved."
        >
          <form action={deleteAdminUserAction} className="w-full max-w-xl space-y-4">
            <input type="hidden" name="userId" value={user.id} />
            <label className="block text-sm font-medium text-slate-950">
              Type <span className="font-bold">DELETE</span> to confirm
              <input
                required
                name="confirm"
                placeholder="Type DELETE"
                className="mt-2 w-full rounded-2xl border border-rose-300 bg-white px-4 py-3 text-sm"
              />
            </label>
            <Button type="submit" variant="danger">
              Remove user from platform access
            </Button>
          </form>
        </AdminDangerZone>
      ) : canDelete && isSelf ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-1 h-5 w-5 text-amber-700" />
            <div>
              <h2 className="font-semibold text-amber-950">Protected Platform Owner account</h2>
              <p className="mt-1 text-sm text-amber-900">
                You are viewing your own account, so destructive removal is hidden to prevent accidental owner lockout.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <AuditLogTable
        logs={user.auditLogs.map((log) => ({
          ...log,
          actorUser: null,
          organization: null,
          country: null,
        }))}
        selectedLogId={query.logId ?? null}
        detailHrefBase={`/admin/users/${user.id}`}
      />
    </AdminShell>
  );
}
