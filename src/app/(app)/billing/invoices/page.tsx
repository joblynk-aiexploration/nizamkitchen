import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { listMemberAccountingDocuments } from "@/server/accounting/accounting-service";

export const dynamic = "force-dynamic";

export default async function BillingInvoicesPage() {
  const session = await requireMembership();
  const invoices = await listMemberAccountingDocuments(session, "invoice");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billing" title="Invoices" description="Invoices generated for your paid orders, home chef requests, and subscriptions." />
      <DocumentList documents={invoices} empty="No invoices are available yet." />
    </div>
  );
}

function DocumentList({ documents, empty }: { documents: Awaited<ReturnType<typeof listMemberAccountingDocuments>>; empty: string }) {
  if (!documents.length) return <Card className="text-sm text-[var(--text-secondary)]">{empty}</Card>;
  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card key={doc.id} className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[var(--text-primary)]">{doc.documentNumber}</p>
            <p className="text-sm text-[var(--text-secondary)]">{doc.paymentOrder.module} · issued {doc.issuedAt.toLocaleDateString()}</p>
          </div>
          <p className="font-semibold">{doc.currencyCode} {doc.totalAmount.toString()}</p>
        </Card>
      ))}
    </div>
  );
}
