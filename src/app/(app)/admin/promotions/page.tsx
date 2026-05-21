import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePlatformRole } from "@/lib/auth/session";
import { listAdminPromotions } from "@/server/promotions";

export const dynamic = "force-dynamic";

export default async function AdminPromotionsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const promotions = await listAdminPromotions(session);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell
      session={session}
      title="Promotions"
      description="Manage platform coupons, seller-specific discounts, country/city targeting, usage limits, credits, and referrals."
      actions={canManage ? <Button asChild><Link href="/admin/promotions/new">New promotion</Link></Button> : null}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Active promotions" value={promotions.filter((promo) => promo.status === "active").length} />
        <SummaryCard label="Total redemptions" value={promotions.reduce((sum, promo) => sum + promo.redemptions.length, 0)} />
        <SummaryCard label="Seller promos" value={promotions.filter((promo) => promo.scope === "seller").length} />
      </div>

      {promotions.length === 0 ? <EmptyState title="No promotions yet" description="Create a platform promo code or let eligible sellers create seller-scoped discounts." /> : null}

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              <tr>
                <th className="py-3 pr-4">Code</th>
                <th className="py-3 pr-4">Scope</th>
                <th className="py-3 pr-4">Discount</th>
                <th className="py-3 pr-4">Target</th>
                <th className="py-3 pr-4">Usage</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {promotions.map((promotion) => (
                <tr key={promotion.id} className="border-t border-[var(--color-border)]">
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-[var(--color-ink)]">{promotion.code}</p>
                    <p className="text-xs text-[var(--color-muted)]">{promotion.name}</p>
                  </td>
                  <td className="py-4 pr-4"><Badge tone={promotion.status === "active" ? "success" : promotion.status === "disabled" ? "neutral" : "warning"}>{promotion.status}</Badge></td>
                  <td className="py-4 pr-4">{formatDiscount(promotion)}</td>
                  <td className="py-4 pr-4">
                    <p>{promotion.sellerOrganization?.name ?? "Platform"}</p>
                    <p className="text-xs text-[var(--color-muted)]">{[promotion.countryCode, promotion.region, promotion.city].filter(Boolean).join(" / ") || "Global"}</p>
                  </td>
                  <td className="py-4 pr-4">{promotion.redemptions.length}{promotion.usageLimit ? ` / ${promotion.usageLimit}` : ""}</td>
                  <td className="py-4"><Button asChild variant="secondary"><Link href={`/admin/promotions/${promotion.id}`}>Open</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
    </Card>
  );
}

function formatDiscount(promotion: { discountType: string; percentOff: unknown; amountOff: unknown; currencyCode: string | null }) {
  if (promotion.discountType === "percent") return `${Number(promotion.percentOff ?? 0)}% off`;
  if (promotion.discountType === "free_delivery") return "Free delivery";
  return `${promotion.currencyCode ?? ""} ${Number(promotion.amountOff ?? 0).toFixed(2)} off`;
}
