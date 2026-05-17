import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireMembership } from "@/lib/auth/session";
import { canAccessMealPlanner, getMealPlanPreference } from "@/server/meal-plans";
import { createMealPlanAction } from "../actions";

export const dynamic = "force-dynamic";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function NewMealPlanPage() {
  const session = await requireMembership();
  const organizationId = session.activeOrganization.id;
  const enabled = await canAccessMealPlanner({
    organizationId,
    platformRole: session.user.platformRole,
  });

  if (!enabled) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Meal Planner"
          title="Meal planner is not enabled"
          description="Ask a platform admin to enable the meal planner feature flag for this organization."
        />
      </div>
    );
  }

  const preference = await getMealPlanPreference(organizationId);
  const today = new Date();
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endDate = addDays(startDate, 6);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Meal Planner"
        title="Create a meal plan"
        description="Start with a date range and household size, then add recipes and custom meals day by day."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <Card>
          <form action={createMealPlanAction} className="space-y-8">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="name">
                  Plan name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue="Weekly family plan"
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="startDate">
                  Start date
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={toDateInput(startDate)}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="endDate">
                  End date
                </label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  required
                  defaultValue={toDateInput(endDate)}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="householdSize">
                  Household size
                </label>
                <input
                  id="householdSize"
                  name="householdSize"
                  type="number"
                  min="1"
                  max="100"
                  required
                  defaultValue={preference?.defaultHouseholdSize ?? 4}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-[var(--color-ink)]" htmlFor="notes">
                  Planning notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  defaultValue={preference?.dietaryNotes ?? ""}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm"
                  placeholder="Weeknight shortcuts, dietary notes, or prep reminders..."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white"
              >
                Create meal plan
              </button>
              <Link
                href="/meal-plans"
                className="rounded-2xl border border-[var(--color-border)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">What happens next</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--color-ink)]">{"Plan -> Grocery List -> Cook"}</h2>
          </div>

          <div className="space-y-4 text-sm leading-6 text-[var(--color-muted)]">
            <p>1. Create the date range and household size.</p>
            <p>2. Add recipe-backed meals and any custom placeholders for takeout, leftovers, or prep days.</p>
            <p>3. Generate a grocery list that reuses the existing grocery engine and ignores custom meals automatically.</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
            Your saved preferences will prefill household size and planning notes here. You can update them anytime from meal preference settings.
          </div>

          <Link href="/settings/meal-preferences" className="text-sm font-semibold text-[var(--color-primary)]">
            Open meal preferences
          </Link>
        </Card>
      </div>
    </div>
  );
}
