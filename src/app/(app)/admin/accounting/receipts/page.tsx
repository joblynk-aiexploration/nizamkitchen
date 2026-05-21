import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAccountingDocuments } from "@/server/accounting/accounting-service";
import { AccountingTabs, Money } from "../_accounting-ui";

export const dynamic = "force-dynamic";

export default async function AccountingReceiptsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const receipts = await listAccountingDocuments(session, { documentType: "receipt" });
  return (
    <AdminShell session={session} title="Receipts" description="Receipts issued after provider-confirmed or manually reconciled paid payment orders.">
      <AccountingTabs />
      <AdminDataTable
        data={receipts}
        emptyMessage="No receipts generated yet."
        columns={[
          { key: "number", header: "Receipt", render: (receipt) => <span className="font-semibold">{receipt.documentNumber}</span> },
          { key: "source", header: "Source", render: (receipt) => `${receipt.paymentOrder.provider} · ${receipt.paymentOrder.module}` },
          { key: "total", header: "Total", render: (receipt) => <Money currencyCode={receipt.currencyCode} amount={receipt.totalAmount} /> },
          { key: "status", header: "Status", render: (receipt) => receipt.status },
          { key: "issued", header: "Issued", render: (receipt) => receipt.issuedAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}
