import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { listSellerPromotions } from "@/server/promotions";
import { createCateringPromotionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CateringPromotionsPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "home_catering") {
    return <EmptyState title="Home catering only" description="Promotion tools are available for home catering organizations." />;
  }
  const promotions = await listSellerPromotions(session);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Home catering" title="Promotions" description="Create seller-scoped discounts that are validated server-side by country, seller, date, and usage limits." />
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">New seller promotion</h2>
        <form action={createCateringPromotionAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <TextInput label="Code" name="code" placeholder="WEEKEND10" required />
          <TextInput label="Name" name="name" placeholder="Weekend biryani discount" required />
          <SelectInput label="Status" name="status" options={[{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "disabled", label: "Disabled" }]} />
          <SelectInput label="Discount type" name="discountType" options={[{ value: "percent", label: "Percent" }, { value: "fixed_amount", label: "Fixed amount" }]} />
          <TextInput label="Percent off" name="percentOff" type="number" min="0" max="100" step="0.01" />
          <TextInput label="Amount off" name="amountOff" type="number" min="0" step="0.01" />
          <TextInput label="Minimum order" name="minOrderAmount" type="number" min="0" step="0.01" />
          <TextInput label="Usage limit" name="usageLimit" type="number" min="1" />
          <div className="md:col-span-2"><Button type="submit">Create promotion</Button></div>
        </form>
      </Card>
      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Your promotions</h2>
        {promotions.length === 0 ? <EmptyState title="No promotions" description="Seller promotions you create will appear here." /> : null}
        <div className="mt-4 space-y-3">
          {promotions.map((promotion) => (
            <div key={promotion.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] p-4">
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{promotion.code}</p>
                <p className="text-sm text-[var(--color-muted)]">{promotion.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={promotion.status === "active" ? "success" : "neutral"}>{promotion.status}</Badge>
                <span className="text-sm text-[var(--color-muted)]">{promotion.redemptions.length} uses</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
