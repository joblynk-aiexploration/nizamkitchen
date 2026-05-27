import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAccountingDocumentsPage } from "@/server/accounting/accounting-service";
import { AccountingTabs, Money } from "../_accounting-ui";

export const dynamic = "force-dynamic";

export default async function AccountingReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const receipts = await listAccountingDocumentsPage(session, { documentType: "receipt", page: params.page });
  return (
    <AdminShell session={session} title="Receipts" description="Receipts issued after provider-confirmed or manually reconciled paid payment orders.">
      <AccountingTabs />
      <AdminDataTable
        data={receipts.items}
        emptyMessage="No receipts generated yet."
        pagination={receipts.pagination}
        paginationBasePath="/admin/accounting/receipts"
        paginationSearchParams={params}
        paginationItemLabel="receipts"
        columns={[
          { key: "number", header: "Receipt", render: (receipt) => <Link href={`/admin/accounting/receipts/${receipt.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">{receipt.documentNumber}</Link> },
          { key: "source", header: "Source", render: (receipt) => `${receipt.paymentOrder.provider} · ${receipt.paymentOrder.module}` },
          { key: "total", header: "Total", render: (receipt) => <Money currencyCode={receipt.currencyCode} amount={receipt.totalAmount} /> },
          { key: "status", header: "Status", render: (receipt) => receipt.status },
          { key: "issued", header: "Issued", render: (receipt) => receipt.issuedAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}
