import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { listPaymentRefunds } from "@/server/payments/admin";

export const dynamic = "force-dynamic";

export default async function PaymentRefundsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const refunds = await listPaymentRefunds(session);
  return (
    <AdminShell session={session} title="Payment refunds" description="Refund records are normalized here. Provider-specific refund execution will be added through gateway adapters.">
      <AdminDataTable
        data={refunds}
        emptyMessage="No payment refunds yet."
        columns={[
          { key: "order", header: "Payment order", render: (refund) => refund.paymentOrderId.slice(0, 10) },
          { key: "provider", header: "Provider", render: (refund) => refund.provider },
          { key: "status", header: "Status", render: (refund) => <Badge tone={refund.status === "succeeded" ? "success" : refund.status === "failed" ? "danger" : "warning"}>{refund.status}</Badge> },
          { key: "amount", header: "Amount", render: (refund) => `${refund.currencyCode} ${refund.amount}` },
          { key: "reason", header: "Reason", render: (refund) => refund.reason ?? "Not provided" },
        ]}
      />
    </AdminShell>
  );
}
