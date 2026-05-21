import { requireMembership } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { listSellerSettlementReports } from "@/server/accounting/accounting-service";

export const dynamic = "force-dynamic";

export default async function PaymentSettlementsPage() {
  const session = await requireMembership();
  const reports = await listSellerSettlementReports(session.activeOrganization.id);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payments" title="Seller settlements" description="Settlement summaries for seller payouts and commissions." />
      {reports.length ? reports.map((report) => (
        <Card key={report.id} className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{report.periodStart.toLocaleDateString()} - {report.periodEnd.toLocaleDateString()}</p>
            <p className="text-sm text-[var(--text-secondary)]">{report.status}</p>
          </div>
          <p className="font-semibold">{report.currencyCode} {report.sellerNetAmount.toString()}</p>
        </Card>
      )) : <Card className="text-sm text-[var(--text-secondary)]">No settlement reports are available yet.</Card>}
    </div>
  );
}
