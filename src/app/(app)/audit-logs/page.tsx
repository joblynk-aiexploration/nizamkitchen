import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const session = await requireMembership();
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: session.activeOrganization.id },
    include: { actorUser: true },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

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
    </div>
  );
}
