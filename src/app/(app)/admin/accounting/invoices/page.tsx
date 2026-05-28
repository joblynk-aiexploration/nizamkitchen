import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAccountingDocumentsPage } from "@/server/accounting/accounting-service";
import { AccountingTabs, Money } from "../_accounting-ui";

export const dynamic = "force-dynamic";

export default async function AccountingInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const invoices = await listAccountingDocumentsPage(session, { documentType: "invoice", page: params.page });
  return (
    <AdminShell session={session} title="Invoices" description="Issued invoices generated from paid food orders, home chef requests, and billing subscriptions.">
      <AccountingTabs />
      <AdminDataTable
        data={invoices.items}
        emptyMessage="No invoices generated yet."
        pagination={invoices.pagination}
        paginationBasePath="/admin/accounting/invoices"
        paginationSearchParams={params}
        paginationItemLabel="invoices"
        columns={[
          { key: "number", header: "Invoice", render: (invoice) => <Link href={`/admin/accounting/invoices/${invoice.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">{invoice.documentNumber}</Link> },
          { key: "module", header: "Source", render: (invoice) => `${invoice.paymentOrder.module} · ${invoice.paymentOrder.moduleEntityId}` },
          { key: "customer", header: "Customer org", render: (invoice) => invoice.customerOrganizationId ?? "Platform" },
          { key: "total", header: "Total", render: (invoice) => <Money currencyCode={invoice.currencyCode} amount={invoice.totalAmount} /> },
          { key: "issued", header: "Issued", render: (invoice) => invoice.issuedAt.toLocaleString() },
        ]}
      />
    </AdminShell>
  );
}
