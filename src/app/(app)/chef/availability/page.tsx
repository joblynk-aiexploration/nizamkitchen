import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requireMembership } from "@/lib/auth/session";
import { canAccessChefMarketplace, getChefProfileForOrganization, isChefBusiness } from "@/server/chefs";
import { upsertChefAvailabilityAction } from "../actions";

export const dynamic = "force-dynamic";

const days = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export default async function ChefAvailabilityPage() {
  const session = await requireMembership();
  const enabled = await canAccessChefMarketplace({ organizationId: session.activeOrganization.id, platformRole: session.user.platformRole });
  if (!enabled || !isChefBusiness(session.activeOrganization.organizationType)) {
    return <EmptyState title="Availability unavailable" description="Chef availability tools are available only for enabled chef businesses." />;
  }
  const profile = await getChefProfileForOrganization(session.activeOrganization.id);
  if (!profile) {
    return <EmptyState title="Create a chef profile first" description="Availability attaches to your chef profile." />;
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Chef marketplace" title="Availability" description="Set rough weekly availability. This is not live scheduling yet." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {profile.availability.map((slot) => (
          <Card key={slot.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-[var(--color-ink)]">{days[slot.dayOfWeek]?.label ?? `Day ${slot.dayOfWeek}`}</p>
              <Badge tone={slot.isAvailable ? "success" : "neutral"}>{slot.isAvailable ? "Available" : "Unavailable"}</Badge>
            </div>
            <p className="mt-3 text-sm text-[var(--color-muted)]">{slot.startTime} - {slot.endTime}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Set day availability</h2>
        <form action={upsertChefAvailabilityAction} className="mt-5 grid gap-4 md:grid-cols-5">
          <SelectInput label="Day" name="dayOfWeek" options={days} />
          <TextInput label="Start time" name="startTime" type="time" defaultValue="09:00" required />
          <TextInput label="End time" name="endTime" type="time" defaultValue="17:00" required />
          <label className="flex items-end gap-2 pb-3 text-sm text-[var(--color-ink)]">
            <input type="checkbox" name="isAvailable" defaultChecked />
            Available
          </label>
          <div className="flex items-end"><Button type="submit">Save</Button></div>
        </form>
      </Card>
    </div>
  );
}
