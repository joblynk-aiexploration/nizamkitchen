import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getPaymentsOverview } from "@/server/payments/admin";

export const dynamic = "force-dynamic";

const paymentSections = [
  { href: "/admin/payments/gateways", group: "Configuration", label: "Gateway registry", owner: "Platform finance", description: "Configure providers, countries, currencies, and encrypted credentials." },
  { href: "/admin/payments/configurations", group: "Configuration", label: "Country configuration", owner: "Regional operations", description: "Set default gateways, wallet availability, tax, and commission placeholders." },
  { href: "/admin/payments/settings", group: "Configuration", label: "Safety settings", owner: "Platform operations", description: "Review operational controls and gateway readiness." },
  { href: "/admin/payments/transactions", group: "Money movement", label: "Transactions", owner: "Finance operations", description: "Review payment orders and normalized transaction history." },
  { href: "/admin/payments/refunds", group: "Money movement", label: "Refunds", owner: "Support operations", description: "Track refund requests and provider refund records." },
  { href: "/admin/payments/disputes", group: "Risk", label: "Disputes", owner: "Trust and safety", description: "Monitor provider disputes and evidence deadlines." },
  { href: "/admin/payments/payouts", group: "Seller finance", label: "Payouts", owner: "Seller operations", description: "View seller payout account readiness and payout records." },
  { href: "/admin/payments/webhooks", group: "Reliability", label: "Webhooks", owner: "Engineering operations", description: "Inspect idempotent provider webhook events." },
];

export default async function AdminPaymentsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const overview = await getPaymentsOverview(session);

  return (
    <AdminShell session={session} title="Payment control center" description="Provider-agnostic payment infrastructure for hosted checkout, wallet integrations, refunds, disputes, and seller payouts. No raw card data is collected by NizamKitchen.">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#082f49,#115e59)] shadow-2xl shadow-slate-200/80">
        <div className="grid gap-8 p-8 text-white lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100">Payment operations</p>
            <h2 className="mt-4 max-w-3xl font-serif text-4xl leading-tight text-white md:text-5xl">
              Enterprise payment oversight without exposing sensitive gateway data.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50/90">
              Monitor checkout health, subscription payments, refunds, disputes, payouts, and provider webhooks from one controlled workspace.
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Readiness summary</p>
            <div className="mt-5 space-y-3">
              <ReadinessLine label="Credential encryption" ok={overview.encryptionConfigured} />
              <ReadinessLine label="Raw card storage" ok />
              <ReadinessLine label="Provider webhooks tracked" ok={overview.webhooks >= 0} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Gateways" value={overview.gateways} detail="Active and configured provider records" />
        <Metric label="Payment orders" value={overview.orders} detail="Checkout and payment intent records" />
        <Metric label="Transactions" value={overview.transactions} detail="Captured provider transaction history" />
        <Metric label="Webhook events" value={overview.webhooks} detail="Received provider callbacks" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card className={overview.encryptionConfigured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className={overview.encryptionConfigured ? "text-sm font-semibold text-emerald-950" : "text-sm font-semibold text-amber-950"}>
                Credential encryption
              </p>
              <p className={overview.encryptionConfigured ? "mt-1 text-sm leading-6 text-emerald-800" : "mt-1 text-sm leading-6 text-amber-800"}>
                Gateway secrets are encrypted server-side and only masked previews are shown after save. Payment credentials are never displayed in full.
              </p>
            </div>
            <Badge tone={overview.encryptionConfigured ? "success" : "warning"}>
              {overview.encryptionConfigured ? "Configured" : "Setup required"}
            </Badge>
          </div>
        </Card>

        <Card className="bg-slate-950 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Operating principle</p>
          <p className="mt-3 text-lg font-semibold text-white">Hosted checkout only</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            NizamKitchen stores payment state, invoices, receipts, refunds, and audit trails. Card details stay with the enabled payment provider.
          </p>
        </Card>
      </section>

      <Card className="p-0">
        <div className="border-b border-[var(--color-border)] px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">Operations directory</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">Payment work areas</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              These rows are informational. Use the action link when you intentionally want to manage or review a specific area.
            </p>
          </div>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {paymentSections.map((section) => (
            <div key={section.href} className="grid gap-4 px-6 py-5 md:grid-cols-[160px_1fr_180px_120px] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{section.group}</p>
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-ink)]">{section.label}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{section.description}</p>
              </div>
              <div className="text-sm text-slate-600">{section.owner}</div>
              <Link href={section.href} className="inline-flex justify-self-start rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:bg-slate-50">
                Manage
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Card className="min-h-36 bg-white">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
      <p className="mt-3 text-sm leading-5 text-[var(--color-muted)]">{detail}</p>
    </Card>
  );
}

function ReadinessLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/10 px-4 py-3 text-sm">
      <span className="text-emerald-50">{label}</span>
      <span className={ok ? "font-semibold text-emerald-100" : "font-semibold text-amber-100"}>
        {ok ? "Ready" : "Needs setup"}
      </span>
    </div>
  );
}
