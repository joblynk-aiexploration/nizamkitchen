import Link from "next/link";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import type { GoogleMapsPublicConfig } from "@/server/maps/google-maps-config";

type Action = (formData: FormData) => void | Promise<void>;

type FulfillmentTab = {
  href: string;
  label: string;
};

export function FulfillmentTabs({ basePath }: { basePath: string }) {
  const tabs: FulfillmentTab[] = [
    { href: basePath, label: "Overview" },
    { href: `${basePath}/pickup`, label: "Pickup" },
    { href: `${basePath}/delivery-zones`, label: "Delivery zones" },
    { href: `${basePath}/time-slots`, label: "Time slots" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Button key={tab.href} asChild variant="secondary" className="px-3 py-2 text-sm">
          <Link href={tab.href}>{tab.label}</Link>
        </Button>
      ))}
    </div>
  );
}

export function PickupLocationForm({
  action,
  mapsConfig,
}: {
  action: Action;
  mapsConfig: GoogleMapsPublicConfig;
}) {
  return (
    <Card>
      <form action={action} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Add pickup location</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Customers see a safe snapshot after the order is scheduled.</p>
        </div>
        <TextInput label="Pickup label" name="label" placeholder="Main kitchen pickup" required />
        <LocationPicker
          label="Pickup address"
          mapsConfig={mapsConfig}
          hint="Google autocomplete is used when configured. Manual address entry remains available."
          fieldNames={{
            addressLine1: "addressLine1",
            addressLine2: "addressLine2",
            city: "city",
            region: "region",
            countryCode: "countryCode",
            postalCode: "postalCode",
            latitude: "latitude",
            longitude: "longitude",
            providerPlaceId: "providerPlaceId",
          }}
          defaultValue={{ countryCode: mapsConfig.defaultCountry }}
        />
        <TextArea label="Pickup instructions" name="instructions" placeholder="Example: Use side entrance, call on arrival." />
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput label="Timezone" name="timezone" placeholder="America/Chicago" />
          <SelectInput label="Status" name="status" options={recordStatusOptions} defaultValue="active" />
          <label className="flex items-end gap-2 pb-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isDefault" className="h-4 w-4" /> Default pickup location
          </label>
        </div>
        <Button type="submit">Save pickup location</Button>
      </form>
    </Card>
  );
}

export function DeliveryZoneForm({ action }: { action: Action }) {
  return (
    <Card>
      <form action={action} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Add delivery zone</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Use city/postal matching or a radius from a Google-picked center point.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Zone name" name="name" placeholder="Dallas 10-mile delivery" required />
          <SelectInput label="Status" name="status" options={recordStatusOptions} defaultValue="active" />
          <TextInput label="City" name="city" />
          <TextInput label="Region / state" name="region" />
          <TextInput label="Postal codes" name="postalCodes" hint="Comma-separated. Example: 75001, 75002" />
          <TextInput label="Radius km" name="radiusKm" type="number" min="0" step="0.1" />
          <TextInput label="Center latitude" name="centerLatitude" type="number" step="0.000001" />
          <TextInput label="Center longitude" name="centerLongitude" type="number" step="0.000001" />
          <TextInput label="Delivery fee" name="deliveryFeeAmount" type="number" min="0" step="0.01" defaultValue="0" />
          <TextInput label="Free delivery at" name="freeDeliveryAt" type="number" min="0" step="0.01" />
          <TextInput label="Minimum order" name="minimumOrderAmount" type="number" min="0" step="0.01" />
          <TextInput label="Estimated minutes" name="estimatedMinutes" type="number" min="0" />
        </div>
        <TextArea label="Description" name="description" />
        <Button type="submit">Save delivery zone</Button>
      </form>
    </Card>
  );
}

export function TimeSlotForm({ action }: { action: Action }) {
  return (
    <Card>
      <form action={action} className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Add time slot</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Define pickup, delivery, or preorder windows and preparation/cutoff rules.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput label="Label" name="label" placeholder="Friday dinner pickup" required />
          <SelectInput label="Type" name="slotType" options={slotTypeOptions} defaultValue="pickup" />
          <SelectInput label="Day" name="dayOfWeek" options={dayOptions} defaultValue="5" />
          <TextInput label="Start time" name="startTime" type="time" required />
          <TextInput label="End time" name="endTime" type="time" required />
          <TextInput label="Capacity" name="capacity" type="number" min="1" />
          <TextInput label="Preparation minutes" name="preparationMinutes" type="number" min="0" />
          <TextInput label="Cutoff minutes before slot" name="cutoffMinutes" type="number" min="0" />
          <SelectInput label="Status" name="status" options={recordStatusOptions} defaultValue="active" />
        </div>
        <Button type="submit">Save time slot</Button>
      </form>
    </Card>
  );
}

export function FulfillmentStatusBadge({ status }: { status: string }) {
  const tone = status === "active" ? "success" : status === "disabled" ? "warning" : "neutral";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}

const recordStatusOptions = [
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
  { value: "archived", label: "Archived" },
];

const slotTypeOptions = [
  { value: "pickup", label: "Pickup" },
  { value: "delivery", label: "Delivery" },
  { value: "preorder", label: "Preorder" },
];

const dayOptions = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];
