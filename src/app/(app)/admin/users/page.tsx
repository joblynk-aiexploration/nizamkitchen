import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { RoleBadge } from "@/components/ui/role-badge";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Identity" title="Users" description="Platform users with their roles and account activity." />
      <DataTable
        columns={[
          {
            key: "user",
            header: "User",
            render: (item) => (
              <div>
                <p className="font-semibold">{item.fullName}</p>
                <p className="text-[var(--color-muted)]">{item.email}</p>
              </div>
            ),
          },
          {
            key: "role",
            header: "Platform Role",
            render: (item) => (item.platformRole ? <RoleBadge value={item.platformRole} /> : "None"),
          },
          { key: "lastLogin", header: "Last login", render: (item) => formatDate(item.lastLoginAt) },
        ]}
        data={users}
        emptyMessage="No users found."
      />
    </div>
  );
}
