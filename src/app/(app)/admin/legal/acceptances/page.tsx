import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listLegalAcceptances } from "@/server/legal/legal-service";

export const dynamic = "force-dynamic";

export default async function LegalAcceptancesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const acceptances = await listLegalAcceptances(session);

  return (
    <AdminShell
      session={session}
      title="Legal Acceptances"
      description="Latest captured legal document acceptances with version, user, organization, and timestamp."
      actions={<Button asChild variant="secondary"><Link href="/admin/legal">Legal center</Link></Button>}
    >
      <AdminDataTable
        data={acceptances}
        emptyMessage="No legal acceptances have been captured yet."
        columns={[
          { key: "document", header: "Document", render: (acceptance) => <Link href={`/admin/legal/documents/${acceptance.documentId}`} className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-primary)]">{acceptance.document.title}</Link> },
          { key: "version", header: "Version", render: (acceptance) => <Badge tone="neutral">{acceptance.acceptedVersion}</Badge> },
          { key: "user", header: "User", render: (acceptance) => <span className="text-sm">{acceptance.user.fullName ?? acceptance.user.email}</span> },
          { key: "organization", header: "Organization", render: (acceptance) => <span className="text-sm">{acceptance.organization?.name ?? "None"}</span> },
          { key: "acceptedAt", header: "Accepted", render: (acceptance) => <span className="text-sm text-[var(--color-muted)]">{acceptance.acceptedAt.toLocaleString()}</span> },
        ]}
      />
    </AdminShell>
  );
}
