import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { simulateCheckoutQuoteAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PricingSimulatorPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  return (
    <AdminShell session={session} title="Pricing simulator" description="Run a safe checkout quote simulation without creating an order, payment, or production record.">
      <Card>
        <form action={simulateCheckoutQuoteAction} className="grid gap-4 md:grid-cols-3">
          <SelectInput label="Module" name="module" defaultValue="food_order" options={[{ value: "food_order", label: "Food order" }, { value: "home_chef_request", label: "Home chef request" }, { value: "subscription", label: "Subscription" }]} />
          <SelectInput label="Seller type" name="sellerType" defaultValue="home_catering" options={[{ value: "", label: "Any" }, { value: "home_catering", label: "Home Catering" }, { value: "restaurant", label: "Restaurant" }, { value: "chef_staff", label: "Home Chef" }]} />
          <SelectInput label="Fulfillment" name="fulfillmentType" defaultValue="delivery" options={[{ value: "delivery", label: "Delivery" }, { value: "pickup", label: "Pickup" }, { value: "home_service", label: "Home service" }, { value: "digital_subscription", label: "Digital subscription" }]} />
          <TextInput label="Subtotal" name="subtotal" type="number" step="0.01" defaultValue={25} />
          <TextInput label="Tip percent" name="tipPercent" type="number" step="1" defaultValue={15} />
          <TextInput label="Promo code" name="promoCode" />
          <TextInput label="Country" name="countryCode" maxLength={2} defaultValue="US" />
          <TextInput label="State" name="region" placeholder="TX" />
          <TextInput label="City" name="city" placeholder="Frisco" />
          <TextInput label="Currency" name="currencyCode" maxLength={3} defaultValue="USD" />
          <div className="md:col-span-3">
            <Button type="submit">Simulate quote</Button>
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Result handling</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          The simulator server action calculates the quote with the same engine used for checkout. Hook this page to a client result panel when we add interactive admin tools; it already avoids creating real payment records.
        </p>
      </Card>
    </AdminShell>
  );
}
