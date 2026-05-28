import Link from "next/link";
import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { listMemberAccountingDocuments } from "@/server/accounting/accounting-service";
import { formatInvoiceMoney } from "@/server/accounting/invoice-document";

export const dynamic = "force-dynamic";

export default async function PaymentInvoicesPage() {
  const session = await requireMembership();
  const invoices = await listMemberAccountingDocuments(session, "invoice");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payments" title="Payment invoices" description="Organization-visible invoices for payments involving your account." />
      {invoices.length ? invoices.map((invoice) => (
        <Card key={invoice.id} className="flex flex-wrap items-center justify-between gap-4">
          <Link href={`/billing/invoices/${invoice.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">
            {invoice.documentNumber}
          </Link>
          <span>{formatInvoiceMoney(invoice.currencyCode, invoice.totalAmount)}</span>
        </Card>
      )) : <Card className="text-sm text-[var(--text-secondary)]">No invoices are available yet.</Card>}
    </div>
  );
}
