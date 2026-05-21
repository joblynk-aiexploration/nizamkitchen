import { FulfillmentStatusBadge, FulfillmentTabs, TimeSlotForm } from "@/components/fulfillment/fulfillment-forms";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { listSellerTimeSlots } from "@/server/fulfillment/fulfillment-service";
import { saveRestaurantTimeSlotAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RestaurantTimeSlotsPage() {
  const session = await requireMembership();
  if (session.activeOrganization.organizationType !== "restaurant") {
    return <EmptyState title="Restaurant only" description="Time slots are available for restaurant organizations." />;
  }
  const slots = await listSellerTimeSlots(session);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Restaurant" title="Time slots" description="Define pickup, delivery, preorder windows, preparation time, and cutoff rules." />
      <FulfillmentTabs basePath="/restaurant/fulfillment" />
      <TimeSlotForm action={saveRestaurantTimeSlotAction} />
      <div className="grid gap-4">
        {slots.map((slot) => (
          <Card key={slot.id}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-[var(--color-ink)]">{slot.label}</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {dayLabel(slot.dayOfWeek)} · {slot.startTime}-{slot.endTime} · {slot.slotType}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">Prep: {slot.preparationMinutes ?? "not set"} min · Cutoff: {slot.cutoffMinutes ?? "not set"} min · Capacity: {slot.capacity ?? "unlimited"}</p>
              </div>
              <FulfillmentStatusBadge status={slot.status} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function dayLabel(day: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day] ?? "Day";
}
