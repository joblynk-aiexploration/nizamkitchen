import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDangerZone } from "@/components/admin/admin-danger-zone";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryBadge } from "@/components/ui/country-badge";
import { ProfileCompletionCard, ProfileHeader, initialsFromName } from "@/components/profiles/profile-components";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAdminUserDetail } from "@/server/admin/users";
import { getStorageImageUrl } from "@/server/storage/storage-images";
import { getUserProfileCompletion } from "@/server/users/profile";

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
  const [avatarUrl, coverUrl] = await Promise.all([
    getStorageImageUrl(session, user.profilePhotoFileId),
    getStorageImageUrl(session, user.coverPhotoFileId),
  ]);
  const completion = getUserProfileCompletion(user);
  const canMutate = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title={user.fullName}
      description="Inspect platform identity, organization memberships, country assignments, and authentication activity."
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/users">Back to users</Link>
        </Button>
      }
    >
      <ProfileHeader
        coverUrl={coverUrl}
        avatarUrl={avatarUrl}
        name={user.fullName}
        headline={user.headline ?? user.platformRole ?? "NizamKitchen user"}
        location={user.locationText ?? user.location}
        initials={initialsFromName(user.fullName)}
        badges={[<RoleBadge key="role" value={user.platformRole ?? "none"} />, <StatusBadge key="status" value={user.status} />]}
      />
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <ProfileCompletionCard score={completion} />
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <RoleBadge value={user.platformRole ?? "none"} />
            <StatusBadge value={user.status} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email</p>
              <p className="mt-2">{user.email}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Created</p>
              <p className="mt-2">{user.createdAt.toLocaleDateString()}</p>
            </div>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Access snapshot</h2>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Memberships</span>
              <span>{user.memberships.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Country assignments</span>
              <span>{user.countryAssignments.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <span>Recent logins</span>
              <span>{user.sessions.length}</span>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdminDataTable
          data={user.memberships}
          emptyMessage="This user has no organization memberships."
          columns={[
            {
              key: "organization",
              header: "Organization",
              render: (membership) => (
                <div>
                  <Link href={`/admin/organizations/${membership.organization.id}`} className="font-semibold text-[var(--color-primary)]">
                    {membership.organization.name}
                  </Link>
                  <p className="text-[var(--color-muted)]">{membership.organization.organizationType}</p>
                </div>
              ),
            },
            {
              key: "role",
              header: "Membership role",
              render: (membership) => <RoleBadge value={membership.role} />,
            },
            {
              key: "status",
              header: "Status",
              render: (membership) => <StatusBadge value={membership.status} />,
            },
          ]}
        />

        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Country assignments</h2>
          <div className="mt-5 space-y-3">
            {user.countryAssignments.length ? (
              user.countryAssignments.map((assignment) => (
                <CountryBadge
                  key={assignment.id}
                  countryCode={assignment.country.countryCode}
                  countryName={assignment.country.countryName}
                />
              ))
            ) : (
              <p className="text-sm text-[var(--color-muted)]">No direct country assignments.</p>
            )}
          </div>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Recent sessions</h3>
          <div className="mt-3 space-y-3">
            {user.sessions.map((sessionItem) => (
              <div key={sessionItem.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                <p>{sessionItem.createdAt.toLocaleString()}</p>
                <p className="text-[var(--color-muted)]">{sessionItem.ipAddress ?? "unknown IP"}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {canMutate ? (
        <AdminDangerZone
          title="User access controls"
          description="Platform role changes and account status updates affect cross-tenant reach and are reserved for platform administrators."
        >
          {["active", "suspended", "disabled"].map((status) => (
            <form key={status} action={`/api/admin/users/${user.id}/status`} method="post">
              <input type="hidden" name="status" value={status} />
              <Button type="submit" variant={status === "active" ? "secondary" : "danger"}>
                Set {status}
              </Button>
            </form>
          ))}
          <form action={`/api/admin/users/${user.id}/role`} method="post" className="flex items-center gap-3">
            <select name="platformRole" defaultValue={user.platformRole ?? ""} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
              <option value="">none</option>
              <option value="platform_owner">platform_owner</option>
              <option value="platform_admin">platform_admin</option>
              <option value="country_manager">country_manager</option>
              <option value="support_admin">support_admin</option>
              <option value="auditor">auditor</option>
            </select>
            <Button type="submit">Update platform role</Button>
          </form>
        </AdminDangerZone>
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
