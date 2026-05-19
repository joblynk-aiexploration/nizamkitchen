import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getPaymentsOverview } from "@/server/payments/admin";

export const dynamic = "force-dynamic";

const paymentSections = [
  { href: "/admin/payments/gateways", label: "Gateway registry", description: "Configure providers, countries, currencies, and encrypted credentials." },
  { href: "/admin/payments/configurations", label: "Country configuration", description: "Set default gateways, wallet availability, tax, and commission placeholders." },
  { href: "/admin/payments/transactions", label: "Transactions", description: "Review payment orders and normalized transaction history." },
  { href: "/admin/payments/refunds", label: "Refunds", description: "Track refund requests and provider refund records." },
  { href: "/admin/payments/disputes", label: "Disputes", description: "Monitor provider disputes and evidence deadlines." },
  { href: "/admin/payments/payouts", label: "Payouts", description: "View seller payout account readiness and payout records." },
  { href: "/admin/payments/webhooks", label: "Webhooks", description: "Inspect idempotent provider webhook events." },
  { href: "/admin/payments/settings", label: "Safety settings", description: "Review operational controls and gateway readiness." },
];

export default async function AdminPaymentsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const overview = await getPaymentsOverview(session);

  return (
    <AdminShell session={session} title="Payment control center" description="Provider-agnostic payment infrastructure for hosted checkout, wallet integrations, refunds, disputes, and seller payouts. No raw card data is collected by NizamKitchen.">
      <section className="grid gap-4 md:grid-cols-4">
        <Card><Metric label="Gateways" value={overview.gateways} /></Card>
        <Card><Metric label="Payment orders" value={overview.orders} /></Card>
        <Card><Metric label="Transactions" value={overview.transactions} /></Card>
        <Card><Metric label="Webhook events" value={overview.webhooks} /></Card>
      </section>

      <Card className="border-amber-200 bg-amber-50">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-950">Credential encryption</p>
            <p className="mt-1 text-sm text-amber-800">
              Gateway secrets are encrypted server-side with ENCRYPTION_KEY and only masked previews are shown after save.
            </p>
          </div>
          <Badge tone={overview.encryptionConfigured ? "success" : "warning"}>
            {overview.encryptionConfigured ? "Configured" : "Setup required"}
          </Badge>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {paymentSections.map((section) => (
          <Card key={section.href} className="flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">{section.label}</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{section.description}</p>
            </div>
            <Button asChild variant="secondary">
              <Link href={section.href}>Open</Link>
            </Button>
          </Card>
        ))}
      </section>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
    </>
  );
}
