import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listLegalConsentEvents } from "@/server/legal/legal-service";

export const dynamic = "force-dynamic";

export default async function LegalConsentEventsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const consents = await listLegalConsentEvents(session);

  return (
    <AdminShell
      session={session}
      title="Legal Consent Events"
      description="Immutable consent snapshots for sensitive actions such as background-check authorization."
      actions={<Button asChild variant="secondary"><Link href="/admin/legal">Legal center</Link></Button>}
    >
      <AdminDataTable
        data={consents}
        emptyMessage="No legal consent events have been captured yet."
        columns={[
          { key: "type", header: "Consent", render: (consent) => <Badge tone="neutral">{consent.consentType}</Badge> },
          { key: "status", header: "Status", render: (consent) => <Badge tone={consent.status === "accepted" ? "success" : "warning"}>{consent.status}</Badge> },
          { key: "version", header: "Version", render: (consent) => <span className="text-sm">{consent.version}</span> },
          { key: "user", header: "User", render: (consent) => <span className="text-sm">{consent.user.fullName ?? consent.user.email}</span> },
          { key: "organization", header: "Organization", render: (consent) => <span className="text-sm">{consent.organization?.name ?? "None"}</span> },
          { key: "createdAt", header: "Captured", render: (consent) => <span className="text-sm text-[var(--color-muted)]">{consent.createdAt.toLocaleString()}</span> },
        ]}
      />
    </AdminShell>
  );
}
