import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { requirePlatformRole } from "@/lib/auth/session";
import { listCommissionRecords } from "@/server/accounting/accounting-service";
import { AccountingTabs, Money } from "../_accounting-ui";

export const dynamic = "force-dynamic";

export default async function AccountingCommissionsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const commissions = await listCommissionRecords(session);
  return (
    <AdminShell session={session} title="Commission records" description="Platform commission ledger derived from server-calculated payment orders.">
      <AccountingTabs />
      <AdminDataTable
        data={commissions}
        emptyMessage="No commission records generated yet."
        columns={[
          { key: "order", header: "Payment order", render: (record) => record.paymentOrderId },
          { key: "seller", header: "Seller", render: (record) => record.sellerOrganizationId ?? "Platform" },
          { key: "gross", header: "Gross", render: (record) => <Money currencyCode={record.currencyCode} amount={record.grossAmount} /> },
          { key: "fee", header: "Platform fee", render: (record) => <Money currencyCode={record.currencyCode} amount={record.platformFeeAmount} /> },
          { key: "seller", header: "Seller amount", render: (record) => <Money currencyCode={record.currencyCode} amount={record.sellerAmount} /> },
          { key: "status", header: "Status", render: (record) => record.status },
        ]}
      />
    </AdminShell>
  );
}
