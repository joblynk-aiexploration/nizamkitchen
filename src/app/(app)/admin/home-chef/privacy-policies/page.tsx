import Link from "next/link";
import { HomeChefPrivacyPolicyStatus, HomeChefRevealTrigger } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listHomeChefPrivacyPolicies } from "@/server/home-chef";
import { upsertHomeChefPrivacyPolicyAction } from "./actions";

export const dynamic = "force-dynamic";

const requestTypeOptions = [
  { value: "", label: "Any request type" },
  { value: "recipe", label: "Recipe" },
  { value: "meal_plan", label: "Meal plan" },
  { value: "occasion", label: "Occasion / event" },
  { value: "weekly_cooking", label: "Weekly cooking" },
  { value: "daily_cooking", label: "Daily cooking" },
  { value: "custom", label: "Custom quote" },
];

const revealOptions = Object.values(HomeChefRevealTrigger).map((value) => ({
  value,
  label: value.replace(/_/g, " "),
}));

const statusOptions = Object.values(HomeChefPrivacyPolicyStatus).map((value) => ({
  value,
  label: value,
}));

export default async function HomeChefPrivacyPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin"]);
  const query = await searchParams;
  const policies = await listHomeChefPrivacyPolicies(session);

  return (
    <AdminShell
      session={session}
      title="Home Chef privacy policies"
      description="Control when customer names, service addresses, and contact options are revealed to platform-managed home chefs."
      actions={
        <Button asChild variant="secondary">
          <Link href="/admin/home-chef-requests">Home Chef requests</Link>
        </Button>
      }
    >
      <FormMessage message={query.message} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Policy matrix</h2>
          {policies.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No privacy policies exist yet. Create a default policy before sending home chef offers.</p>
          ) : (
            <div className="space-y-3">
              {policies.map((policy) => (
                <div key={policy.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">
                        {[policy.city, policy.region, policy.countryCode, policy.requestType?.replace(/_/g, " ") ?? "any request"]
                          .filter(Boolean)
                          .join(" · ") || "Default policy"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        Address: {policy.revealExactAddressTrigger.replace(/_/g, " ")} · name: {policy.revealCustomerNameTrigger.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Badge tone={policy.status === "active" ? "success" : "neutral"}>{policy.status}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-[var(--color-muted)]">
                    Messaging {policy.allowPreAcceptanceMessaging ? "allowed" : "disabled"} · proxy {policy.allowPhoneProxyAfterLock ? "on" : "off"} · real phone {policy.allowRealPhoneReveal ? "allowed" : "hidden"} · email {policy.allowEmailReveal ? "allowed" : "hidden"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Create or update policy</h2>
          <form action={upsertHomeChefPrivacyPolicyAction} className="space-y-4">
            <SelectInput label="Request type" name="requestType" options={requestTypeOptions} />
            <div className="grid gap-3 md:grid-cols-3">
              <TextInput label="Country" name="countryCode" placeholder="US" maxLength={2} />
              <TextInput label="Region" name="region" placeholder="TX" />
              <TextInput label="City" name="city" placeholder="Frisco" />
            </div>
            <SelectInput label="Exact address reveal trigger" name="revealExactAddressTrigger" options={revealOptions} defaultValue="booking_locked" />
            <SelectInput label="Customer name reveal trigger" name="revealCustomerNameTrigger" options={revealOptions} defaultValue="booking_locked" />
            <div className="grid gap-3 md:grid-cols-2">
              <TextInput label="Emergency window hours" name="emergencyContactWindowHours" type="number" min={1} max={168} defaultValue={24} />
              <TextInput label="Revoke after completion days" name="revokeAccessAfterCompletionDays" type="number" min={0} defaultValue={7} />
            </div>
            <SelectInput label="Status" name="status" options={statusOptions} defaultValue="active" />
            <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-[var(--color-ink)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="allowPreAcceptanceMessaging" defaultChecked />
                Allow anonymous pre-acceptance messaging
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="allowFirstNameBeforeAcceptance" />
                Allow first name before acceptance for custom/high-value requests
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="allowPhoneProxyAfterLock" defaultChecked />
                Enable proxy contact after booking lock
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="allowRealPhoneReveal" />
                Allow real phone reveal
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="allowEmailReveal" />
                Allow email reveal
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="revokeAccessOnCancellation" defaultChecked />
                Revoke access on cancellation, decline, dispute, or reassignment
              </label>
            </div>
            <Button type="submit" className="w-full justify-center">Save privacy policy</Button>
          </form>
        </Card>
      </div>
    </AdminShell>
  );
}
