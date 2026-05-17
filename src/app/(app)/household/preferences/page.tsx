import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canAccessFamilyProfiles, getHouseholdProfile } from "@/server/household";
import { updateHouseholdProfileAction } from "../actions";
import { ComingSoonFamilyProfiles, cookingDays, HouseholdNav, NonHouseholdState } from "../_components";

export const dynamic = "force-dynamic";

const fieldClass = "w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm";

export default async function HouseholdPreferencesPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requireMembership();
  const { message } = await searchParams;
  const org = session.activeOrganization;
  const enabled = await canAccessFamilyProfiles({ organizationId: org.id, platformRole: session.user.platformRole });
  if (!enabled) return <ComingSoonFamilyProfiles />;
  if (org.organizationType !== "household") return <NonHouseholdState organizationType={org.organizationType} />;

  const [profile, countries, cuisines] = await Promise.all([
    getHouseholdProfile(org.id),
    prisma.country.findMany({ where: { isActive: true }, orderBy: { countryName: "asc" } }),
    prisma.cuisine.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Household" title="Household preferences" description="Save serving sizes, spice comfort, cooking rhythm, cuisines, and regional defaults for this organization." />
      <HouseholdNav />
      <FormMessage message={message} />

      <Card>
        <form action={updateHouseholdProfileAction} className="space-y-8">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Household name" id="displayName">
              <input id="displayName" name="displayName" required defaultValue={profile?.displayName ?? org.name} className={fieldClass} />
            </Field>
            <Field label="Default country" id="countryCode">
              <select id="countryCode" name="countryCode" defaultValue={profile?.countryCode ?? org.countryCode} className={fieldClass}>
                {countries.map((country) => <option key={country.countryCode} value={country.countryCode}>{country.countryName}</option>)}
              </select>
            </Field>
            <Field label="Default household size" id="defaultHouseholdSize">
              <input id="defaultHouseholdSize" name="defaultHouseholdSize" type="number" min="1" max="100" required defaultValue={profile?.defaultHouseholdSize ?? 4} className={fieldClass} />
            </Field>
            <Field label="Default servings" id="defaultServings">
              <input id="defaultServings" name="defaultServings" type="number" min="1" max="100" required defaultValue={profile?.defaultServings ?? profile?.defaultHouseholdSize ?? 4} className={fieldClass} />
            </Field>
            <Field label="Adults" id="adultsCount">
              <input id="adultsCount" name="adultsCount" type="number" min="0" max="100" defaultValue={profile?.adultsCount ?? ""} className={fieldClass} />
            </Field>
            <Field label="Children" id="childrenCount">
              <input id="childrenCount" name="childrenCount" type="number" min="0" max="100" defaultValue={profile?.childrenCount ?? ""} className={fieldClass} />
            </Field>
            <Field label="Spice preference" id="defaultSpiceLevel">
              <select id="defaultSpiceLevel" name="defaultSpiceLevel" defaultValue={profile?.defaultSpiceLevel ?? "medium"} className={fieldClass}>
                <option value="mild">Mild</option><option value="medium">Medium</option><option value="hot">Hot</option><option value="extra_hot">Extra hot</option>
              </select>
            </Field>
            <Field label="Cooking skill" id="cookingSkillLevel">
              <select id="cookingSkillLevel" name="cookingSkillLevel" defaultValue={profile?.cookingSkillLevel ?? "intermediate"} className={fieldClass}>
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option>
              </select>
            </Field>
            <Field label="Measurement system" id="preferredMeasurementSystem">
              <select id="preferredMeasurementSystem" name="preferredMeasurementSystem" defaultValue={profile?.preferredMeasurementSystem ?? org.measurementSystem} className={fieldClass}>
                <option value="metric">Metric</option><option value="imperial">Imperial</option><option value="mixed">Mixed</option>
              </select>
            </Field>
            <Field label="Grocery budget currency" id="groceryBudgetCurrency">
              <input id="groceryBudgetCurrency" name="groceryBudgetCurrency" maxLength={3} defaultValue={profile?.groceryBudgetCurrency ?? org.currencyCode} className={fieldClass} />
            </Field>
            <Field label="Grocery budget placeholder" id="groceryBudgetAmount">
              <input id="groceryBudgetAmount" name="groceryBudgetAmount" type="number" min="0" step="0.01" defaultValue={profile?.groceryBudgetAmount ?? ""} className={fieldClass} />
            </Field>
          </div>

          <div>
            <p className="text-sm font-semibold">Preferred cuisines</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {cuisines.map((cuisine) => (
                <label key={cuisine.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                  <input type="checkbox" name="preferredCuisineIds" value={cuisine.id} defaultChecked={profile?.preferredCuisineIds.includes(cuisine.id) ?? false} />
                  <span>{cuisine.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">Weekly cooking days</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {cookingDays.map((day) => (
                <label key={day.value} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm">
                  <input type="checkbox" name="weeklyCookingDays" value={day.value} defaultChecked={profile?.weeklyCookingDays.includes(day.value) ?? false} />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Field label="Notes" id="notes">
            <textarea id="notes" name="notes" rows={4} defaultValue={profile?.notes ?? ""} className={fieldClass} placeholder="Dietary notes intentionally entered by the household, cooking routines, school lunch constraints..." />
          </Field>

          <button type="submit" className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">Save household profile</button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="block text-sm font-semibold text-[var(--color-ink)]">{label}</label><div className="mt-2">{children}</div></div>;
}
