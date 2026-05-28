import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { getPaginationInput, getPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const paginationInput = getPaginationInput(params, { defaultPageSize: 25 });
  const where = { organizationId: session.activeOrganization.id };
  const [totalMemberships, memberships] = await Promise.all([
    prisma.membership.count({ where }),
    prisma.membership.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "asc" },
      skip: paginationInput.skip,
      take: paginationInput.take,
    }),
  ]);
  const pagination = getPaginationMeta(totalMemberships, paginationInput);

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
      <PaginationControls
        pagination={pagination}
        basePath="/team"
        searchParams={params}
        itemLabel="team members"
      />
    </div>
  );
}
