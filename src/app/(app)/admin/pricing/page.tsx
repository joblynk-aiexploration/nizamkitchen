import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listFeePolicies } from "@/server/pricing/fee-policy-service";
import { listCheckoutQuotes } from "@/server/pricing/quote-snapshot-service";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const [policies, quotes] = await Promise.all([listFeePolicies(), listCheckoutQuotes()]);
  const activePolicies = policies.filter((policy) => policy.status === "active").length;

  return (
    <AdminShell
      session={session}
      title="Checkout pricing"
      description="Configure service fees, delivery fees, small order fees, taxes, tips, discounts, commissions, and checkout quote snapshots."
      actions={<Button asChild><Link href="/admin/pricing/simulator">Open simulator</Link></Button>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active policies</p>
          <p className="mt-2 text-4xl font-bold text-[var(--color-ink)]">{activePolicies}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fee rules</p>
          <p className="mt-2 text-4xl font-bold text-[var(--color-ink)]">{policies.reduce((sum, policy) => sum + policy.rules.length, 0)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent quotes</p>
          <p className="mt-2 text-4xl font-bold text-[var(--color-ink)]">{quotes.length}</p>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["/admin/pricing/policies", "Fee policies", "Create country, seller, module, and fulfillment scoped pricing policies."],
          ["/admin/pricing/rules", "Fee rules", "Review service fee, delivery fee, small order, tax, and commission rules."],
          ["/admin/pricing/quotes", "Quote snapshots", "Inspect tamper-resistant checkout totals and line items."],
          ["/admin/pricing/simulator", "Simulator", "Test totals without creating a real order or payment."],
        ].map(([href, title, description]) => (
          <Card key={href}>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
            <p className="mt-2 min-h-16 text-sm text-[var(--color-muted)]">{description}</p>
            <Button asChild variant="secondary" className="mt-4 w-full"><Link href={href}>Open</Link></Button>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
