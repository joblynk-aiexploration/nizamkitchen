import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { listMemberAccountingDocumentsPage } from "@/server/accounting/accounting-service";
import { formatInvoiceMoney } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";

export default async function BillingInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const invoices = await listMemberAccountingDocumentsPage(session, "invoice", { page: params.page });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billing" title="Invoices" description="Invoices generated for your paid orders, home chef requests, and subscriptions." />
      <DocumentList documents={invoices.items} empty="No invoices are available yet." />
      <PaginationControls pagination={invoices.pagination} basePath="/billing/invoices" searchParams={params} itemLabel="invoices" />
    </div>
  );
}

function DocumentList({ documents, empty }: { documents: Awaited<ReturnType<typeof listMemberAccountingDocumentsPage>>["items"]; empty: string }) {
  if (!documents.length) return <Card className="text-sm text-[var(--text-secondary)]">{empty}</Card>;
  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Link key={doc.id} href={`/billing/invoices/${doc.id}`} className="block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <Card className="flex flex-wrap items-center justify-between gap-4 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-xl">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">{doc.documentNumber}</p>
              <p className="text-sm text-[var(--text-secondary)]">{doc.paymentOrder.module} · issued {doc.issuedAt.toLocaleDateString()}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">View, print, or download PDF</p>
            </div>
            <p className="font-semibold">{formatInvoiceMoney(doc.currencyCode, doc.totalAmount)}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
