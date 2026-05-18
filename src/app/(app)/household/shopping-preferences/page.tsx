import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessFamilyProfiles, getShoppingPreference } from "@/server/household";
import { updateShoppingPreferenceAction } from "../actions";
import { ComingSoonFamilyProfiles, HouseholdNav, NonHouseholdState, cookingDays } from "../_components";

export const dynamic = "force-dynamic";

const fieldClass = "w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm";

export default async function HouseholdShoppingPreferencesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const { message } = await searchParams;
  const org = session.activeOrganization;
  const enabled = await canAccessFamilyProfiles({ organizationId: org.id, platformRole: session.user.platformRole });
  if (!enabled) return <ComingSoonFamilyProfiles />;
  if (org.organizationType !== "household") return <NonHouseholdState organizationType={org.organizationType} />;

  const preference = await getShoppingPreference(org.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Household"
        title="Shopping preferences"
        description="Store lightweight shopping defaults now so future grocery automation can respect household habits."
      />
      <HouseholdNav />
      <FormMessage message={message} />

      <Card className="border-blue-200 bg-blue-50">
        <p className="text-sm text-blue-900">
          Shopping automation is a placeholder for a later phase. These preferences do not place orders or connect to stores yet.
        </p>
      </Card>

      <Card>
        <form action={updateShoppingPreferenceAction} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Preferred store name" id="preferredStoreName">
              <input
                id="preferredStoreName"
                name="preferredStoreName"
                defaultValue={preference?.preferredStoreName ?? ""}
                placeholder="e.g. Patel Brothers, Costco, local halal market"
                className={fieldClass}
              />
            </Field>
            <Field label="Preferred shopping day" id="preferredShoppingDay">
              <select id="preferredShoppingDay" name="preferredShoppingDay" defaultValue={preference?.preferredShoppingDay ?? ""} className={fieldClass}>
                <option value="">No preference</option>
                {cookingDays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </Field>
            <Field label="Preferred method" id="preferredDeliveryMethod">
              <select id="preferredDeliveryMethod" name="preferredDeliveryMethod" defaultValue={preference?.preferredDeliveryMethod ?? "no_preference"} className={fieldClass}>
                <option value="no_preference">No preference</option>
                <option value="in_store">In-store</option>
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </Field>
          </div>

          <Field label="Shopping notes" id="notes">
            <textarea
              id="notes"
              name="notes"
              rows={5}
              defaultValue={preference?.notes ?? ""}
              placeholder="Preferred brands, halal store notes, delivery window constraints, budget reminders..."
              className={fieldClass}
            />
          </Field>

          <button type="submit" className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">
            Save shopping preferences
          </button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="block text-sm font-semibold text-[var(--color-ink)]">{label}</label><div className="mt-2">{children}</div></div>;
}
