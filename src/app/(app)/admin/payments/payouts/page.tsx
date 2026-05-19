import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { requirePlatformRole } from "@/lib/auth/session";
import { listSellerPayouts } from "@/server/payments/admin";

export const dynamic = "force-dynamic";

export default async function PaymentPayoutsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const payouts = await listSellerPayouts(session);
  return (
    <AdminShell session={session} title="Seller payouts" description="Seller payout records and account readiness are prepared for future provider adapters.">
      <AdminDataTable
        data={payouts}
        emptyMessage="No seller payouts yet."
        columns={[
          { key: "seller", header: "Seller organization", render: (payout) => payout.organizationId.slice(0, 10) },
          { key: "provider", header: "Provider", render: (payout) => payout.provider },
          { key: "status", header: "Status", render: (payout) => <Badge tone={payout.status === "paid" ? "success" : payout.status === "failed" ? "danger" : "warning"}>{payout.status}</Badge> },
          { key: "amount", header: "Amount", render: (payout) => `${payout.currencyCode} ${payout.amount}` },
          { key: "period", header: "Period", render: (payout) => payout.periodStart ? `${payout.periodStart.toLocaleDateString()} - ${payout.periodEnd?.toLocaleDateString() ?? "open"}` : "Not set" },
        ]}
      />
    </AdminShell>
  );
}
