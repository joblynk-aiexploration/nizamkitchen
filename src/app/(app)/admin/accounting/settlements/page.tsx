import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Card } from "@/components/ui/card";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listSettlementReports } from "@/server/accounting/accounting-service";
import { AccountingTabs, Message, Money } from "../_accounting-ui";
import { generateSettlementReportsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AccountingSettlementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const params = await searchParams;
  const settlements = await listSettlementReports(session);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";
  return (
    <AdminShell session={session} title="Seller settlement reports" description="Seller payout visibility and settlement summaries for marketplace orders.">
      <AccountingTabs />
      <Message message={params.message} />
      {canManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Generate settlement reports</h2>
          <form action={generateSettlementReportsAction} className="mt-4 grid gap-4 md:grid-cols-3">
            <TextInput label="Period start" name="periodStart" type="date" required />
            <TextInput label="Period end" name="periodEnd" type="date" required />
            <button className="rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-semibold text-[var(--button-primary-text)]">Generate</button>
          </form>
        </Card>
      ) : null}
      <AdminDataTable
        data={settlements}
        emptyMessage="No seller settlement reports generated yet."
        columns={[
          { key: "seller", header: "Seller", render: (report) => report.sellerOrganization.name },
          { key: "period", header: "Period", render: (report) => `${report.periodStart.toLocaleDateString()} - ${report.periodEnd.toLocaleDateString()}` },
          { key: "gross", header: "Gross", render: (report) => <Money currencyCode={report.currencyCode} amount={report.grossAmount} /> },
          { key: "fees", header: "Platform fees", render: (report) => <Money currencyCode={report.currencyCode} amount={report.platformFeeAmount} /> },
          { key: "net", header: "Seller net", render: (report) => <Money currencyCode={report.currencyCode} amount={report.sellerNetAmount} /> },
          { key: "status", header: "Status", render: (report) => report.status },
        ]}
      />
    </AdminShell>
  );
}
