import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPaymentDisputes } from "@/server/payments/admin";

export const dynamic = "force-dynamic";

export default async function PaymentDisputesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const disputes = await listPaymentDisputes(session);
  return (
    <AdminShell session={session} title="Payment disputes" description="Provider disputes are stored for review. Evidence submission remains provider-managed until adapters are implemented.">
      <AdminDataTable
        data={disputes}
        emptyMessage="No disputes found."
        columns={[
          { key: "provider", header: "Provider", render: (dispute) => dispute.provider },
          { key: "status", header: "Status", render: (dispute) => <Badge tone={dispute.status === "lost" ? "danger" : dispute.status === "won" ? "success" : "warning"}>{dispute.status}</Badge> },
          { key: "amount", header: "Amount", render: (dispute) => dispute.amount ? `${dispute.currencyCode} ${dispute.amount}` : "Not provided" },
          { key: "reason", header: "Reason", render: (dispute) => dispute.reason ?? "Not provided" },
          { key: "due", header: "Evidence due", render: (dispute) => dispute.evidenceDueBy?.toLocaleDateString() ?? "Not set" },
        ]}
      />
    </AdminShell>
  );
}
