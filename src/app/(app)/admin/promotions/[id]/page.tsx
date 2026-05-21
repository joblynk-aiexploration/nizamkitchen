import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminPromotion } from "@/server/promotions";

export const dynamic = "force-dynamic";

export default async function AdminPromotionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const promotion = await getAdminPromotion(session, id);
  if (!promotion) notFound();

  return (
    <AdminShell session={session} title={promotion.name} description={`Promotion code ${promotion.code}`}>
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Status" value={promotion.status} />
        <Metric label="Scope" value={promotion.scope} />
        <Metric label="Discount" value={promotion.discountType === "percent" ? `${Number(promotion.percentOff ?? 0)}%` : `${promotion.currencyCode ?? ""} ${Number(promotion.amountOff ?? 0).toFixed(2)}`} />
        <Metric label="Redemptions" value={`${promotion.redemptions.length}${promotion.usageLimit ? ` / ${promotion.usageLimit}` : ""}`} />
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{promotion.countryCode ?? "Global"}</Badge>
          {promotion.city ? <Badge tone="neutral">{promotion.city}</Badge> : null}
          {promotion.sellerOrganization ? <Badge tone="success">{promotion.sellerOrganization.name}</Badge> : <Badge tone="neutral">Platform</Badge>}
        </div>
        <p className="text-sm text-[var(--color-muted)]">{promotion.description || "No description."}</p>
        <p className="text-xs text-[var(--color-muted)]">
          Discounts are calculated server-side. Client-submitted discount amounts are ignored.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Redemptions</h2>
        {promotion.redemptions.length === 0 ? <EmptyState title="No redemptions" description="Usage will appear here after checkout validation." /> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr>
                <th className="py-3 pr-4">Module</th>
                <th className="py-3 pr-4">Original</th>
                <th className="py-3 pr-4">Discount</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {promotion.redemptions.map((redemption) => (
                <tr key={redemption.id} className="border-t border-[var(--color-border)]">
                  <td className="py-3 pr-4">{redemption.module}</td>
                  <td className="py-3 pr-4">{redemption.currencyCode} {Number(redemption.originalAmount).toFixed(2)}</td>
                  <td className="py-3 pr-4">{redemption.currencyCode} {Number(redemption.discountAmount).toFixed(2)}</td>
                  <td className="py-3 pr-4"><Badge tone={redemption.status === "applied" ? "success" : "warning"}>{redemption.status}</Badge></td>
                  <td className="py-3">{redemption.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{value}</p>
    </Card>
  );
}
