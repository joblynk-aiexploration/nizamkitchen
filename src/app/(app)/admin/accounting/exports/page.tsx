import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { AccountingTabs } from "../_accounting-ui";

export const dynamic = "force-dynamic";

const exports = [
  ["invoices", "Invoices"],
  ["receipts", "Receipts"],
  ["commissions", "Commissions"],
  ["settlements", "Seller settlements"],
  ["taxes", "Tax configuration"],
];

export default async function AccountingExportsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  return (
    <AdminShell session={session} title="Accounting exports" description="Download accounting CSV exports without secrets, card data, or raw provider JSON.">
      <AccountingTabs />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exports.map(([type, label]) => (
          <Card key={type} className="flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{label}</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">CSV export scoped by your admin role and country access.</p>
            </div>
            <a href={`/api/admin/accounting/export?type=${type}`} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-primary)] hover:bg-slate-50">
              Download CSV
            </a>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
