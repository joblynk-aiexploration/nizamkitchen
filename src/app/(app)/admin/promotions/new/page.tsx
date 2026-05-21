import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { createAdminPromotionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAdminPromotionPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  return (
    <AdminShell session={session} title="New promotion" description="Create a server-validated promo code with optional seller, country, city, date, and usage limits.">
      <Card>
        <form action={createAdminPromotionAction} className="grid gap-5 md:grid-cols-2">
          <TextInput label="Code" name="code" placeholder="HYD10" required />
          <TextInput label="Name" name="name" placeholder="Hyderabadi launch offer" required />
          <SelectInput label="Status" name="status" options={[{ value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }]} />
          <SelectInput label="Scope" name="scope" options={[{ value: "platform", label: "Platform" }, { value: "seller", label: "Seller specific" }]} />
          <SelectInput label="Promotion type" name="promotionType" options={[{ value: "promo_code", label: "Promo code" }, { value: "seller_discount", label: "Seller discount" }, { value: "referral_reward", label: "Referral reward" }, { value: "loyalty_credit", label: "Loyalty credit" }]} />
          <SelectInput label="Discount type" name="discountType" options={[{ value: "percent", label: "Percent" }, { value: "fixed_amount", label: "Fixed amount" }, { value: "free_delivery", label: "Free delivery" }, { value: "credit_amount", label: "Credit amount" }]} />
          <TextInput label="Percent off" name="percentOff" type="number" step="0.01" min="0" max="100" />
          <TextInput label="Amount off" name="amountOff" type="number" step="0.01" min="0" />
          <TextInput label="Max discount" name="maxDiscountAmount" type="number" step="0.01" min="0" />
          <TextInput label="Minimum order" name="minOrderAmount" type="number" step="0.01" min="0" />
          <TextInput label="Currency" name="currencyCode" placeholder="USD" maxLength={3} />
          <TextInput label="Seller organization ID" name="sellerOrganizationId" placeholder="Optional for seller-specific discounts" />
          <TextInput label="Country" name="countryCode" placeholder="US" maxLength={2} />
          <TextInput label="State/region" name="region" />
          <TextInput label="City" name="city" />
          <TextInput label="Starts at" name="startsAt" type="datetime-local" />
          <TextInput label="Ends at" name="endsAt" type="datetime-local" />
          <TextInput label="Usage limit" name="usageLimit" type="number" min="1" />
          <TextInput label="Per-user limit" name="perUserLimit" type="number" min="1" />
          <div className="md:col-span-2 grid gap-3 rounded-2xl border border-[var(--color-border)] p-4 text-sm text-[var(--color-ink)] md:grid-cols-3">
            <label className="flex items-center gap-2"><input type="checkbox" name="appliesToFoodOrders" defaultChecked /> Food orders</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="appliesToHomeChefRequests" defaultChecked /> Home chef payments</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="appliesToSubscriptions" /> Subscriptions</label>
          </div>
          <div className="md:col-span-2">
            <TextArea label="Description" name="description" />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Create promotion</Button>
          </div>
        </form>
      </Card>
    </AdminShell>
  );
}
