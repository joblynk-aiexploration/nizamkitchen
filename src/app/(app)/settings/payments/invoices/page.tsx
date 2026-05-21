import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { listMemberAccountingDocuments } from "@/server/accounting/accounting-service";

export const dynamic = "force-dynamic";

export default async function PaymentInvoicesPage() {
  const session = await requireMembership();
  const invoices = await listMemberAccountingDocuments(session, "invoice");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payments" title="Payment invoices" description="Organization-visible invoices for payments involving your account." />
      {invoices.length ? invoices.map((invoice) => (
        <Card key={invoice.id} className="flex justify-between gap-4">
          <span className="font-semibold">{invoice.documentNumber}</span>
          <span>{invoice.currencyCode} {invoice.totalAmount.toString()}</span>
        </Card>
      )) : <Card className="text-sm text-[var(--text-secondary)]">No invoices are available yet.</Card>}
    </div>
  );
}
