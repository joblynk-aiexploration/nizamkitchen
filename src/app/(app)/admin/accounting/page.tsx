import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminAccountingPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  return (
    <AdminShell session={session} title="Accounting" description="Accounting exports and reconciliation controls for payments, refunds, payouts, and commissions.">
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Coming soon</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Payment operations, commissions, refunds, and payout reports are available under Payments. This page is reserved for accounting-specific workflows.
        </p>
      </Card>
    </AdminShell>
  );
}
