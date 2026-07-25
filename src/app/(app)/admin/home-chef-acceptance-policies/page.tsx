import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  HOME_CHEF_LEAD_TIME_LABELS,
  formatHomeChefResponseWindow,
  listHomeChefAcceptancePolicies,
} from "@/server/home-chef";
import { upsertHomeChefAcceptancePolicyAction } from "./actions";

export const dynamic = "force-dynamic";

const leadTimeOptions = [
  { value: "advance_booking", label: "Advance booking" },
  { value: "short_term", label: "Short term" },
  { value: "same_day", label: "Same day" },
  { value: "recurring", label: "Recurring" },
  { value: "custom", label: "Custom/manual" },
];

const requestTypeOptions = [
  { value: "", label: "Any request type" },
  { value: "recipe", label: "Recipe" },
  { value: "meal_plan", label: "Meal plan" },
  { value: "occasion", label: "Occasion" },
  { value: "weekly_cooking", label: "Weekly cooking" },
  { value: "daily_cooking", label: "Daily cooking" },
  { value: "custom", label: "Custom" },
];

export default async function HomeChefAcceptancePoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
  const query = await searchParams;
  const policies = await listHomeChefAcceptancePolicies(session);

  return (
    <AdminShell
      session={session}
      title="Home Chef acceptance policies"
      description="Configure response windows and cascading offer rules for platform-managed independent home chefs."
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/home-chef-requests">Home Chef requests</Link>
        </Button>
      }
    >
      <FormMessage message={query.message} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Active policy matrix</h2>
          {policies.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No custom policies yet. Requests fall back to the default NizamKitchen windows.</p>
          ) : (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div key={policy.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">
                        {HOME_CHEF_LEAD_TIME_LABELS[policy.leadTimeCategory]}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {[policy.city, policy.region, policy.countryCode, policy.requestType?.replace(/_/g, " ") ?? "any type"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={policy.isActive ? "success" : "neutral"}>{policy.isActive ? "Active" : "Disabled"}</Badge>
                      <Badge tone="info">{formatHomeChefResponseWindow(policy.acceptanceWindowMinutes)}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--color-muted)]">
                    Cascade {policy.autoCascadeEnabled ? "on" : "off"} · max {policy.maxCascadeAttempts} attempts · {policy.cascadeDelayMinutes} minute delay · verified chef {policy.requireVerifiedChef ? "required" : "not required"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Create policy</h2>
          <form action={upsertHomeChefAcceptancePolicyAction} className="space-y-4">
            <SelectInput label="Lead-time category" name="leadTimeCategory" options={leadTimeOptions} defaultValue="short_term" />
            <SelectInput label="Request type" name="requestType" options={requestTypeOptions} />
            <div className="grid gap-3 md:grid-cols-3">
              <TextInput label="Country" name="countryCode" placeholder="US" maxLength={2} />
              <TextInput label="Region" name="region" placeholder="IL" />
              <TextInput label="City" name="city" placeholder="Chicago" />
            </div>
            <TextInput label="Acceptance window minutes" name="acceptanceWindowMinutes" type="number" min={5} defaultValue={180} />
            <div className="grid gap-3 md:grid-cols-2">
              <TextInput label="Max cascade attempts" name="maxCascadeAttempts" type="number" min={0} defaultValue={3} />
              <TextInput label="Cascade delay minutes" name="cascadeDelayMinutes" type="number" min={0} defaultValue={10} />
            </div>
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-ink)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="autoCascadeEnabled" defaultChecked />
                Auto-cascade when an offer expires or is declined
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requireAdminReview" defaultChecked />
                Require admin review
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requireVerifiedChef" defaultChecked />
                Require verified chef
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isActive" defaultChecked />
                Active policy
              </label>
            </div>
            <Button type="submit" className="w-full justify-center">Save policy</Button>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
