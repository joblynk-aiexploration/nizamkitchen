import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { listIdentityVerifications } from "@/server/kyc/kyc-service";

export const dynamic = "force-dynamic";

export default async function IdentityVerificationsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const identities = await listIdentityVerifications(session);
  return (
    <AdminShell session={session} title="Identity verifications" description="Hosted-provider identity sessions. No raw identity document data is stored here.">
      <AdminDataTable
        data={identities}
        emptyMessage="No identity verification sessions."
        columns={[
          { key: "seller", header: "Seller", render: (item) => item.organization.name },
          { key: "provider", header: "Provider", render: (item) => item.provider.replace(/_/g, " ") },
          { key: "status", header: "Status", render: (item) => <Badge tone={item.status === "verified" ? "success" : item.status === "failed" ? "danger" : "warning"}>{item.status.replace(/_/g, " ")}</Badge> },
          { key: "providerStatus", header: "Provider status", render: (item) => item.providerStatus ?? "Not reported" },
        ]}
      />
    </AdminShell>
  );
}
