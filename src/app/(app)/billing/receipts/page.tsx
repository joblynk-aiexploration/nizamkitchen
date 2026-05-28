import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { listMemberAccountingDocumentsPage } from "@/server/accounting/accounting-service";
import { formatInvoiceMoney } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";

export default async function BillingReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireMembership();
  const params = await searchParams;
  const receipts = await listMemberAccountingDocumentsPage(session, "receipt", { page: params.page });
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billing" title="Receipts" description="Receipts issued after payment confirmation." />
      {receipts.items.length ? (
        <div className="space-y-3">
          {receipts.items.map((receipt) => (
            <Link key={receipt.id} href={`/billing/receipts/${receipt.id}`} className="block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              <Card className="flex flex-wrap items-center justify-between gap-4 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-xl">
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{receipt.documentNumber}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{receipt.paymentOrder.provider} · {receipt.issuedAt.toLocaleDateString()}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary)]">View, print, or download PDF</p>
                </div>
                <p className="font-semibold">{formatInvoiceMoney(receipt.currencyCode, receipt.totalAmount)}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="text-sm text-[var(--text-secondary)]">No receipts are available yet.</Card>
      )}
      <PaginationControls pagination={receipts.pagination} basePath="/billing/receipts" searchParams={params} itemLabel="receipts" />
    </div>
  );
}
