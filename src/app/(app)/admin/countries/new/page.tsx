import { prisma } from "@/lib/prisma";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { TextInput } from "@/components/ui/text-input";
import { TextArea } from "@/components/ui/text-area";
import { DEFAULT_APP_TIME_ZONE, getAllKnownTimeZoneOptions } from "@/lib/timezones";

const moduleOptions = [
  "recipes",
  "meal_planner",
  "grocery_engine",
  "youtube_references",
  "home_chefs",
  "home_catering",
  "restaurant_fallback",
  "grocery_partners",
  "menus",
  "restaurant_profiles",
  "payments",
  "subscriptions",
  "ai_suggestions",
  "country_specific_recipes",
  "chef_verification",
  "family_profiles",
  "occasion_planning",
  "ramadan_mode",
  "eid_mode",
];

export default async function NewCountryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const params = await searchParams;
  const timeZones = getAllKnownTimeZoneOptions();
  const managers = await prisma.user.findMany({
    where: { platformRole: "country_manager", status: "active" },
    orderBy: { fullName: "asc" },
  });

  return (
    <AdminShell
      session={session}
      title="Create country"
      description="Add a new country with production-safe defaults, module readiness, and assigned country operators."
    >
      <FormMessage message={params.message} />

      <Card>
        <form action="/api/admin/countries" method="post" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput name="countryCode" label="Country code" placeholder="US" required />
            <TextInput name="countryName" label="Country name" placeholder="United States" required />
            <TextInput name="currencyCode" label="Currency code" placeholder="USD" required />
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
              Default timezone
              <select name="defaultTimezone" defaultValue={DEFAULT_APP_TIME_ZONE} className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm" required>
                {timeZones.map((timeZone) => (
                  <option key={timeZone.value} value={timeZone.value}>{timeZone.label}</option>
                ))}
              </select>
            </label>
            <TextInput name="defaultLocale" label="Default locale" placeholder="en-US" required />
            <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
              Measurement system
              <select name="measurementSystem" defaultValue="imperial" className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm" required>
                <option value="imperial">Imperial</option>
                <option value="metric">Metric</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
            <TextInput name="phoneCountryCode" label="Phone country code" placeholder="+1" required />
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">Supported modules</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {moduleOptions.map((module) => (
                <label key={module} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-3 text-sm">
                  <input type="checkbox" name="supportedModules" value={module} />
                  <span>{module}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--color-ink)]">Country managers</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {managers.map((manager) => (
                <label key={manager.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-3 text-sm">
                  <input type="checkbox" name="managerUserIds" value={manager.id} />
                  <span>{manager.fullName} ({manager.email})</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-4 text-sm">
            <input type="checkbox" name="isActive" defaultChecked />
            <span>Activate this country immediately</span>
          </label>

          <TextArea
            name="notes"
            label="Operational notes"
            placeholder="Optional rollout notes for launch readiness."
          />

          <Button type="submit">Create country</Button>
        </form>
      </Card>
    </AdminShell>
  );
}
