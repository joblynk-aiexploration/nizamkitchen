import { IntegrationCategory, IntegrationEnvironment, IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { listIntegrationTemplates } from "@/server/config/platform-config-service";
import { savePlatformIntegrationAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewPlatformIntegrationPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager"]);
  const templates = listIntegrationTemplates();

  return (
    <AdminShell
      session={session}
      title="Create platform integration"
      description="Register an integration shell first, then add encrypted credentials and provider settings."
    >
      <Card>
        <form action={savePlatformIntegrationAction} className="grid gap-4 md:grid-cols-2">
          <TextInput label="Display name" name="displayName" required placeholder="Google OAuth production" />
          <SelectInput label="Provider" name="provider" options={Object.values(IntegrationProvider).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <SelectInput label="Category" name="category" options={Object.values(IntegrationCategory).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <SelectInput label="Environment" name="environment" options={Object.values(IntegrationEnvironment).map((value) => ({ value, label: value }))} />
          <SelectInput label="Status" name="status" options={Object.values(IntegrationStatus).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <TextInput label="Country override" name="countryCode" placeholder="US" maxLength={2} />
          <TextInput label="Region override" name="region" placeholder="Texas" />
          <TextArea label="Description" name="description" placeholder="What this integration controls, who owns it, and any rollout notes." />
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isGlobal" defaultChecked className="h-4 w-4" /> Global fallback configuration
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isDefault" className="h-4 w-4" /> Default for matching provider scope
          </label>
          <div className="md:col-span-2">
            <Button type="submit">Create integration</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Built-in templates</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <div key={template.provider} className="rounded-2xl border border-[var(--color-border)] p-4">
              <p className="font-semibold text-[var(--color-ink)]">{template.displayName}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{template.description}</p>
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                Public keys: {template.publicCredentialKeys.join(", ") || "none"} · Server secrets: {template.serverCredentialKeys.join(", ") || "none"}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
