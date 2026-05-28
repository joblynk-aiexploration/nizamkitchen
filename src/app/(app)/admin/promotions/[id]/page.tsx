import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminPromotion } from "@/server/promotions";
import { updateAdminPromotionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPromotionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const { id } = await params;
  const query = await searchParams;
  const promotion = await getAdminPromotion(session, id);
  if (!promotion) notFound();
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin";

  return (
    <AdminShell session={session} title={promotion.name} description={`Promotion code ${promotion.code}`}>
      <FormMessage message={query.message} />
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

      {canManage ? (
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                Manage promotion
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--color-ink)]">Edit details, targeting, and limits</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Changes are validated server-side and recorded in the audit log.
              </p>
            </div>
            <Badge tone={promotion.status === "active" ? "success" : promotion.status === "archived" ? "neutral" : "warning"}>
              {promotion.status}
            </Badge>
          </div>

          <form action={updateAdminPromotionAction} className="mt-6 grid gap-5 md:grid-cols-2">
            <input type="hidden" name="promotionId" value={promotion.id} />
            <TextInput label="Code" name="code" defaultValue={promotion.code} minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]+" required />
            <TextInput label="Name" name="name" defaultValue={promotion.name} required />
            <SelectInput label="Status" name="status" defaultValue={promotion.status} options={[
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "disabled", label: "Disabled" },
              { value: "expired", label: "Expired" },
              { value: "archived", label: "Archived" },
            ]} />
            <SelectInput label="Scope" name="scope" defaultValue={promotion.scope} options={[
              { value: "platform", label: "Platform" },
              { value: "seller", label: "Seller specific" },
            ]} />
            <SelectInput label="Promotion type" name="promotionType" defaultValue={promotion.promotionType} options={[
              { value: "promo_code", label: "Promo code" },
              { value: "seller_discount", label: "Seller discount" },
              { value: "referral_reward", label: "Referral reward" },
              { value: "loyalty_credit", label: "Loyalty credit" },
              { value: "manual_credit", label: "Manual credit" },
            ]} />
            <SelectInput label="Discount type" name="discountType" defaultValue={promotion.discountType} options={[
              { value: "percent", label: "Percent" },
              { value: "fixed_amount", label: "Fixed amount" },
              { value: "free_delivery", label: "Free delivery" },
              { value: "credit_amount", label: "Credit amount" },
            ]} />
            <TextInput label="Percent off" name="percentOff" type="number" step="0.01" min="0" max="100" defaultValue={decimalValue(promotion.percentOff)} />
            <TextInput label="Amount off" name="amountOff" type="number" step="0.01" min="0" defaultValue={decimalValue(promotion.amountOff)} />
            <TextInput label="Max discount" name="maxDiscountAmount" type="number" step="0.01" min="0" defaultValue={decimalValue(promotion.maxDiscountAmount)} />
            <TextInput label="Minimum order" name="minOrderAmount" type="number" step="0.01" min="0" defaultValue={decimalValue(promotion.minOrderAmount)} />
            <TextInput label="Currency" name="currencyCode" placeholder="USD" maxLength={3} defaultValue={promotion.currencyCode ?? ""} />
            <TextInput label="Seller organization ID" name="sellerOrganizationId" placeholder="Optional for seller-specific discounts" defaultValue={promotion.sellerOrganizationId ?? ""} />
            <TextInput label="Country" name="countryCode" placeholder="US" maxLength={2} defaultValue={promotion.countryCode ?? ""} />
            <TextInput label="State/region" name="region" defaultValue={promotion.region ?? ""} />
            <TextInput label="City" name="city" defaultValue={promotion.city ?? ""} />
            <TextInput label="Starts at" name="startsAt" type="datetime-local" defaultValue={datetimeLocalValue(promotion.startsAt)} />
            <TextInput label="Ends at" name="endsAt" type="datetime-local" defaultValue={datetimeLocalValue(promotion.endsAt)} />
            <TextInput label="Usage limit" name="usageLimit" type="number" min="1" defaultValue={promotion.usageLimit?.toString() ?? ""} />
            <TextInput label="Per-user limit" name="perUserLimit" type="number" min="1" defaultValue={promotion.perUserLimit?.toString() ?? ""} />
            <div className="md:col-span-2 grid gap-3 rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-ink)] md:grid-cols-3">
              <label className="flex items-center gap-2"><input type="checkbox" name="appliesToFoodOrders" defaultChecked={promotion.appliesToFoodOrders} /> Food orders</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="appliesToHomeChefRequests" defaultChecked={promotion.appliesToHomeChefRequests} /> Home chef payments</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="appliesToSubscriptions" defaultChecked={promotion.appliesToSubscriptions} /> Subscriptions</label>
            </div>
            <div className="md:col-span-2">
              <TextArea label="Description" name="description" defaultValue={promotion.description ?? ""} />
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <Button type="submit">Save promotion</Button>
            </div>
          </form>
        </Card>
      ) : null}

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

function decimalValue(value: unknown) {
  if (value == null) return "";
  return Number(value).toString();
}

function datetimeLocalValue(value: Date | null) {
  if (!value) return "";
  const offset = value.getTimezoneOffset();
  const local = new Date(value.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
