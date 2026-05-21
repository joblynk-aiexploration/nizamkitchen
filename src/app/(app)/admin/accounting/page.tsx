import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAccountingDashboard } from "@/server/accounting/accounting-service";
import { AccountingTabs, Message, Metric, Money } from "./_accounting-ui";
import { generateAccountingRecordsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminAccountingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const dashboard = await getAccountingDashboard(session);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title="Accounting"
      description="Tax configuration, invoices, receipts, commissions, seller settlements, revenue reports, and accounting exports."
      actions={canManage ? (
        <form action={generateAccountingRecordsAction}>
          <Button type="submit">Generate accounting records</Button>
        </form>
      ) : null}
    >
      <AccountingTabs />
      <Message message={params.message} />

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Invoices" value={dashboard.invoiceCount} detail={`${dashboard.grossInvoiced.toFixed(2)} invoiced`} />
        <Metric title="Receipts" value={dashboard.receiptCount} detail={`${dashboard.grossReceipts.toFixed(2)} receipted`} />
        <Metric title="Tax recorded" value={dashboard.taxTotal.toFixed(2)} detail="Configured tax only" />
        <Metric title="Platform revenue" value={dashboard.platformRevenue.toFixed(2)} detail="Commission ledger" />
      </div>

      <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
        Tax configuration is a platform-controlled calculation input. NizamKitchen does not provide tax or legal advice, and no jurisdiction-specific tax is calculated unless configured by Platform Owner.
      </Card>

      <AdminDataTable
        data={dashboard.recentDocuments}
        emptyMessage="No invoices or receipts have been generated yet."
        columns={[
          { key: "number", header: "Document", render: (doc) => <Link href={`/admin/accounting/${doc.documentType === "invoice" ? "invoices" : "receipts"}`} className="font-semibold text-[var(--color-primary-strong)]">{doc.documentNumber}</Link> },
          { key: "type", header: "Type", render: (doc) => doc.documentType },
          { key: "amount", header: "Total", render: (doc) => <Money currencyCode={doc.currencyCode} amount={doc.totalAmount} /> },
          { key: "tax", header: "Tax", render: (doc) => <Money currencyCode={doc.currencyCode} amount={doc.taxAmount} /> },
          { key: "issued", header: "Issued", render: (doc) => doc.issuedAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}
