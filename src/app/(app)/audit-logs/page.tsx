import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/ui/page-header";
import { getPaginationInput, getPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const paginationInput = getPaginationInput({ page: params.page });
  const where = { organizationId: session.activeOrganization.id };
  const [totalLogs, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actorUser: true },
      orderBy: { createdAt: "desc" },
      skip: paginationInput.skip,
      take: paginationInput.take,
    }),
  ]);
  const pagination = getPaginationMeta(totalLogs, paginationInput);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Compliance"
        title="Audit logs"
        description="Important tenant-scoped actions are recorded here to support enterprise governance and incident analysis."
      />
      <DataTable
        columns={[
          { key: "action", header: "Action", render: (item) => <span className="font-semibold">{item.action}</span> },
          { key: "actor", header: "Actor", render: (item) => item.actorUser?.email ?? "System" },
          { key: "target", header: "Target", render: (item) => `${item.targetType}${item.targetId ? ` • ${item.targetId}` : ""}` },
          { key: "timestamp", header: "Timestamp", render: (item) => formatDate(item.createdAt) },
        ]}
        data={logs}
        emptyMessage="No audit log entries have been recorded for this organization yet."
      />
      <PaginationControls
        pagination={pagination}
        basePath="/audit-logs"
        searchParams={params}
        itemLabel="audit entries"
      />
    </div>
  );
}
