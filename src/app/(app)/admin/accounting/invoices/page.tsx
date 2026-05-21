import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAccountingDocuments } from "@/server/accounting/accounting-service";
import { AccountingTabs, Money } from "../_accounting-ui";

export const dynamic = "force-dynamic";

export default async function AccountingInvoicesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const invoices = await listAccountingDocuments(session, { documentType: "invoice" });
  return (
    <AdminShell session={session} title="Invoices" description="Issued invoices generated from paid food orders, home chef requests, and billing subscriptions.">
      <AccountingTabs />
      <AdminDataTable
        data={invoices}
        emptyMessage="No invoices generated yet."
        columns={[
          { key: "number", header: "Invoice", render: (invoice) => <span className="font-semibold">{invoice.documentNumber}</span> },
          { key: "module", header: "Source", render: (invoice) => `${invoice.paymentOrder.module} · ${invoice.paymentOrder.moduleEntityId}` },
          { key: "customer", header: "Customer org", render: (invoice) => invoice.customerOrganizationId ?? "Platform" },
          { key: "total", header: "Total", render: (invoice) => <Money currencyCode={invoice.currencyCode} amount={invoice.totalAmount} /> },
          { key: "issued", header: "Issued", render: (invoice) => invoice.issuedAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}
