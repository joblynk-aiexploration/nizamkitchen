import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const logs = await prisma.auditLog.findMany({
    include: {
      actorUser: true,
      organization: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Observability"
        title="Platform audit logs"
        description="Cross-platform event visibility for enterprise support, governance, and audit functions."
      />
      <DataTable
        columns={[
          { key: "action", header: "Action", render: (item) => item.action },
          { key: "actor", header: "Actor", render: (item) => item.actorUser?.email ?? "System" },
          { key: "organization", header: "Organization", render: (item) => item.organization?.name ?? "Platform" },
          { key: "createdAt", header: "Timestamp", render: (item) => formatDate(item.createdAt) },
        ]}
        data={logs}
        emptyMessage="No platform audit logs found."
      />
    </div>
  );
}
