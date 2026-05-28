import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { CountrySelector } from "@/components/admin/country-selector";
import { OrganizationSelector } from "@/components/admin/organization-selector";
import { UserSearchBox } from "@/components/admin/user-search-box";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAdminUsers } from "@/server/admin/users";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "country_manager",
    "support_admin",
    "auditor",
  ]);
  const params = await searchParams;
  const [users, countries, organizations] = await Promise.all([
    listAdminUsers(session, {
      search: params.search,
      platformRole: params.platformRole,
      countryCode: params.countryCode,
      organizationId: params.organizationId,
      page: params.page,
    }),
    prisma.country.findMany({
      select: { countryCode: true, countryName: true },
      orderBy: { countryName: "asc" },
    }),
    prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AdminShell
      session={session}
      title="User management"
      description="Search platform users, review memberships and country assignments, and manage platform-level access only where permitted."
      actions={
        session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin" ? (
          <Button asChild>
            <Link href="/admin/users/new">Create user</Link>
          </Button>
        ) : null
      }
    >
      <form className="rounded-3xl border border-[var(--color-border)] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <UserSearchBox defaultValue={params.search ?? ""} />
          <select name="platformRole" defaultValue={params.platformRole ?? ""} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm">
            <option value="">All platform roles</option>
            <option value="platform_owner">platform_owner</option>
            <option value="platform_admin">platform_admin</option>
            <option value="country_manager">country_manager</option>
            <option value="support_admin">support_admin</option>
            <option value="auditor">auditor</option>
          </select>
          <CountrySelector countries={countries} defaultValue={params.countryCode ?? ""} />
          <OrganizationSelector organizations={organizations} defaultValue={params.organizationId ?? ""} />
          <Button type="submit" variant="secondary">Apply filters</Button>
        </div>
      </form>

      <AdminDataTable
        data={users.items}
        emptyMessage="No users matched the current filters."
        pagination={users.pagination}
        paginationBasePath="/admin/users"
        paginationSearchParams={params}
        paginationItemLabel="users"
        columns={[
          {
            key: "user",
            header: "User",
            render: (user) => (
              <div>
                <Link href={`/admin/users/${user.id}`} className="font-semibold text-[var(--color-primary)]">
                  {user.fullName}
                </Link>
                <p className="text-[var(--color-muted)]">{user.email}</p>
              </div>
            ),
          },
          {
            key: "role",
            header: "Platform role",
            render: (user) => <RoleBadge value={user.platformRole ?? "none"} />,
          },
          {
            key: "scope",
            header: "Memberships",
            render: (user) => (
              <div>
                <p>{user.memberships.length} organizations</p>
                <p className="text-[var(--color-muted)]">{user.countryAssignments.length} country assignments</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (user) => <StatusBadge value={user.status} />,
          },
        ]}
      />
    </AdminShell>
  );
}
