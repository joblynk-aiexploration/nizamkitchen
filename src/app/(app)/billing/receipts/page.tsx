import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { listMemberAccountingDocuments } from "@/server/accounting/accounting-service";

export const dynamic = "force-dynamic";

export default async function BillingReceiptsPage() {
  const session = await requireMembership();
  const receipts = await listMemberAccountingDocuments(session, "receipt");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billing" title="Receipts" description="Receipts issued after payment confirmation." />
      {receipts.length ? (
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <Card key={receipt.id} className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-[var(--text-primary)]">{receipt.documentNumber}</p>
                <p className="text-sm text-[var(--text-secondary)]">{receipt.paymentOrder.provider} · {receipt.issuedAt.toLocaleDateString()}</p>
              </div>
              <p className="font-semibold">{receipt.currencyCode} {receipt.totalAmount.toString()}</p>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-sm text-[var(--text-secondary)]">No receipts are available yet.</Card>
      )}
    </div>
  );
}
