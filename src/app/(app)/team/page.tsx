import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await requireMembership();
  const memberships = await prisma.membership.findMany({
    where: { organizationId: session.activeOrganization.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Access governance"
        title="Team"
        description="Organization members are always loaded through tenant-scoped queries using the active organization context."
      />
      <DataTable
        columns={[
          {
            key: "member",
            header: "Member",
            render: (item) => (
              <div>
                <p className="font-semibold">{item.user.fullName}</p>
                <p className="text-[var(--color-muted)]">{item.user.email}</p>
              </div>
            ),
          },
          { key: "role", header: "Role", render: (item) => <RoleBadge value={item.role} /> },
          { key: "status", header: "Status", render: (item) => <StatusBadge value={item.status} /> },
          { key: "joined", header: "Joined", render: (item) => formatDate(item.createdAt) },
        ]}
        data={memberships}
        emptyMessage="No team members found for this tenant."
      />
    </div>
  );
}
