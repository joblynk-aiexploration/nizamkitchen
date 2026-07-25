import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { getCheckoutQuote } from "@/server/pricing/quote-snapshot-service";

export const dynamic = "force-dynamic";

export default async function CheckoutQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "auditor"]);
  const { id } = await params;
  const quote = await getCheckoutQuote(id);
  if (!quote) notFound();
  return (
    <AdminShell session={session} title="Checkout quote" description="Server-side quote snapshot, line items, and pricing policy metadata.">
      <Card>
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Status" value={quote.status} />
          <Metric label="Module" value={quote.module} />
          <Metric label="Total" value={`${quote.currencyCode} ${Number(quote.totalAmount).toFixed(2)}`} />
          <Metric label="Expires" value={quote.expiresAt.toLocaleString()} />
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Line items</h2>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {quote.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between py-3 text-sm">
              <span>{line.label}</span>
              <span className="font-semibold text-[var(--color-ink)]">{line.currencyCode} {Number(line.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Policy snapshot</h2>
        <pre className="mt-4 max-h-[520px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(quote.pricingPolicySnapshotJson, null, 2)}</pre>
      </Card>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-[var(--color-ink)]">{value}</p>
    </div>
  );
}
