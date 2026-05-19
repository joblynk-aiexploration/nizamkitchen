import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getCommissionReport } from "@/server/payments/operations";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PaymentCommissionsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const report = await getCommissionReport(session);
  return (
    <AdminShell session={session} title="Commission reporting" description="Seller gross sales, NizamKitchen platform commission, and net seller amounts based on server-calculated payment orders.">
      <Card className="text-sm text-[var(--color-muted)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p>Provider processing fees are shown only when providers supply them through transactions. Seller amount never comes from the client.</p>
          <Button asChild variant="secondary"><Link href="/api/admin/payments/export?type=commissions">Export CSV</Link></Button>
        </div>
      </Card>
      <AdminDataTable
        data={report}
        emptyMessage="No commission data yet."
        columns={[
          { key: "seller", header: "Seller", render: (row) => row.sellerOrganizationId },
          { key: "orders", header: "Orders", render: (row) => row.orders },
          { key: "gross", header: "Gross sales", render: (row) => row.grossSales.toFixed(2) },
          { key: "commission", header: "Platform commission", render: (row) => row.platformCommission.toFixed(2) },
          { key: "refunds", header: "Refunds", render: (row) => row.refunds.toFixed(2) },
          { key: "sellerNet", header: "Seller net", render: (row) => row.sellerNet.toFixed(2) },
        ]}
      />
    </AdminShell>
  );
}
