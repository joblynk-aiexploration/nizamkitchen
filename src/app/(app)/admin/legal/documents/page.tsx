import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listLegalDocuments } from "@/server/legal/legal-service";

export const dynamic = "force-dynamic";

export default async function AdminLegalDocumentsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const documents = await listLegalDocuments(session);

  return (
    <AdminShell
      session={session}
      title="Legal Documents"
      description="Versioned legal templates and published documents."
      actions={<Button asChild><Link href="/admin/legal/documents/new">New document</Link></Button>}
    >
      <AdminDataTable
        data={documents}
        emptyMessage="No legal documents found."
        columns={[
          {
            key: "title",
            header: "Document",
            render: (document) => (
              <div>
                <Link href={`/admin/legal/documents/${document.id}`} className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]">{document.title}</Link>
                <p className="text-xs text-[var(--color-muted)]">{document.slug} · {document.version}</p>
              </div>
            ),
          },
          { key: "type", header: "Type", render: (document) => <Badge tone="neutral">{document.documentType}</Badge> },
          { key: "audience", header: "Audience", render: (document) => <span className="text-sm">{document.audience}</span> },
          { key: "status", header: "Status", render: (document) => <Badge tone={document.status === "published" ? "success" : "neutral"}>{document.status}</Badge> },
          { key: "acceptances", header: "Acceptances", render: (document) => <span className="text-sm">{document._count.acceptances}</span> },
        ]}
      />
    </AdminShell>
  );
}
