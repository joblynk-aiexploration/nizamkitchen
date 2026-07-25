import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { DocumentUploadField } from "@/components/storage/file-upload-field";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import type { PhoneCountryOption } from "@/lib/phone";
import type { GoogleMapsPublicConfig } from "@/server/maps/google-maps-config";

type MenuItemForOrder = {
  id: string;
  name: string;
  description?: string | null;
  priceAmount?: number | null;
  currencyCode: string;
  minimumOrderQuantity?: number | null;
  minimumNoticeHours?: number | null;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  preorderRequired: boolean;
  organization: { name: string; organizationType: string };
};

const statusOptions = [
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "preparing", label: "Preparing" },
  { value: "ready_for_pickup", label: "Ready for pickup" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const adminStatusOptions = [{ value: "submitted", label: "Submitted" }, ...statusOptions];

function formatMoney(currencyCode: string, amount?: number | null) {
  if (amount == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

export function FoodOrderRequestForm({
  action,
  item,
  customerName,
  customerEmail,
  mapsConfig,
  phoneOptions,
}: {
  action: (formData: FormData) => void | Promise<void>;
  item: MenuItemForOrder;
  customerName: string;
  customerEmail: string;
  mapsConfig: GoogleMapsPublicConfig;
  phoneOptions: PhoneCountryOption[];
}) {
  const unitPrice = formatMoney(item.currencyCode, item.priceAmount);
  const minimumQuantity = item.minimumOrderQuantity ?? 1;
  const estimatedSubtotal =
    item.priceAmount == null ? null : formatMoney(item.currencyCode, item.priceAmount * minimumQuantity);
  const fulfillmentOptions = [
    item.pickupAvailable ? { value: "pickup", label: "Pickup" } : null,
    item.deliveryAvailable ? { value: "delivery", label: "Delivery" } : null,
    item.preorderRequired ? { value: "preorder", label: "Preorder" } : null,
    { value: "inquiry_only", label: "Inquiry only" },
  ].filter(Boolean) as Array<{ value: string; label: string }>;

  return (
    <Card>
      <form action={action} className="space-y-5">
        <input type="hidden" name="menuItemId" value={item.id} />
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--color-primary)]">Order request</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-ink)]">{item.name}</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{item.organization.name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.pickupAvailable ? <Badge tone="info">Pickup</Badge> : null}
            {item.deliveryAvailable ? <Badge tone="info">Delivery</Badge> : null}
            {item.preorderRequired ? <Badge tone="warning">Preorder</Badge> : null}
            {item.minimumNoticeHours ? <Badge tone="neutral">{item.minimumNoticeHours}h notice</Badge> : null}
            {unitPrice ? <Badge tone="success">{unitPrice}</Badge> : <Badge tone="warning">Price to confirm</Badge>}
          </div>
        </div>

        {item.priceAmount != null ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
            <span className="font-semibold text-emerald-950">Secure checkout is available after this request is created.</span>{" "}
            NizamKitchen will send you to the order checkout step next. Estimated minimum subtotal:{" "}
            <span className="font-semibold text-emerald-950">{estimatedSubtotal}</span>. Card details are entered only on the hosted payment provider page.
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <span className="font-semibold text-amber-950">Online checkout is not available for this item yet.</span>{" "}
            The seller must add a menu price before NizamKitchen can create a payment checkout.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Quantity" name="quantity" type="number" min={item.minimumOrderQuantity ?? 1} defaultValue={item.minimumOrderQuantity ?? 1} required />
          <SelectInput label="Fulfillment" name="fulfillmentType" options={fulfillmentOptions} defaultValue={fulfillmentOptions[0]?.value ?? "inquiry_only"} />
          <TextInput label="Requested date" name="requestedDate" type="date" />
          <TextInput label="Requested time window" name="requestedTimeWindow" placeholder="Example: 5 PM - 7 PM" />
          <TextInput label="Your name" name="customerName" defaultValue={customerName} />
          <PhoneNumberInput
            countryCodeName="customerPhoneCountryCode"
            nationalNumberName="customerPhoneNationalNumber"
            defaultCountryCode={phoneOptions.find((option) => option.countryCode === mapsConfig.defaultCountry)?.phoneCountryCode}
            options={phoneOptions}
          />
          <TextInput label="Email" name="customerEmail" type="email" defaultValue={customerEmail} />
          <TextInput label="Promo code" name="promoCode" placeholder="Optional" />
        </div>
        <LocationPicker
          label="Delivery address"
          mapsConfig={mapsConfig}
          hint="Google autocomplete fills delivery address details when configured. Manual entry always remains available."
          fieldNames={{
            addressLine1: "deliveryAddressLine1",
            addressLine2: "deliveryAddressLine2",
            city: "deliveryCity",
            region: "deliveryRegion",
            countryCode: "deliveryCountryCode",
            postalCode: "deliveryPostalCode",
            latitude: "deliveryLatitude",
            longitude: "deliveryLongitude",
            providerPlaceId: "deliveryProviderPlaceId",
          }}
          defaultValue={{ countryCode: mapsConfig.defaultCountry }}
        />
        <TextArea label="Order notes" name="customerNotes" />
        <TextArea label="Item notes" name="itemNotes" />
        <DocumentUploadField
          label="Order attachment"
          name="orderAttachmentFileId"
          module="orders"
          purpose="order_attachment"
          visibility="organization"
          entityType="food_order"
          hint="Optional: upload a reference image or document for the seller or support team."
        />
        <Button type="submit">
          {item.priceAmount != null ? "Submit order and continue to checkout" : "Submit order request"}
        </Button>
      </form>
    </Card>
  );
}

export function FoodOrderMessageForm({
  action,
  label = "Message",
  orderId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label?: string;
  orderId: string;
}) {
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <TextArea label={label} name="message" required />
      <Button type="submit" variant="secondary">Send message</Button>
    </form>
  );
}

export function FoodOrderStatusForm({
  action,
  admin = false,
  orderId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  admin?: boolean;
  orderId: string;
}) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />
      <SelectInput label="Status" name="status" options={admin ? adminStatusOptions : statusOptions} />
      <TextArea label="Note" name="note" />
      <TextArea label={admin ? "Admin notes" : "Seller notes"} name={admin ? "adminNotes" : "sellerNotes"} />
      <Button type="submit">Update order</Button>
    </form>
  );
}
