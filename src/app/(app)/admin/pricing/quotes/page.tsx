import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listCheckoutQuotes } from "@/server/pricing/quote-snapshot-service";
import { labelize } from "../pricing-forms";

export const dynamic = "force-dynamic";

export default async function CheckoutQuotesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "auditor"]);
  const quotes = await listCheckoutQuotes();
  return (
    <AdminShell session={session} title="Checkout quotes" description="Inspect server-side quote snapshots used before payment.">
      <Card>
        <div className="divide-y divide-[var(--color-border)]">
          {quotes.map((quote) => (
            <div key={quote.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--color-ink)]">{quote.currencyCode} {Number(quote.totalAmount).toFixed(2)}</p>
                  <Badge tone={quote.status === "active" ? "success" : "neutral"}>{labelize(quote.status)}</Badge>
                  <Badge tone="info">{labelize(quote.module)}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{quote.city ?? "Any city"}, {quote.countryCode} · expires {quote.expiresAt.toLocaleString()}</p>
              </div>
              <Button asChild variant="secondary"><Link href={`/admin/pricing/quotes/${quote.id}`}>Inspect</Link></Button>
            </div>
          ))}
          {quotes.length === 0 ? <p className="py-4 text-sm text-[var(--color-muted)]">No checkout quotes have been created yet.</p> : null}
        </div>
      </Card>
    </AdminShell>
  );
}
