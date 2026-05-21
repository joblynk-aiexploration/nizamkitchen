import { IntegrationEnvironment, IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { getIntegrationTemplate, listIntegrationTemplates } from "@/server/config/platform-config-service";
import { ApiManagementTabs, categoryLabel } from "../_components";
import { saveApiIntegrationAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewApiIntegrationPage() {
  const session = await requirePlatformRole(["platform_owner"]);
  const templates = listIntegrationTemplates();
  const defaultTemplate = getIntegrationTemplate(IntegrationProvider.google_maps);

  return (
    <AdminShell
      session={session}
      title="Add API"
      description="Create a provider record for a global or country-scoped API. Add encrypted credentials after saving."
    >
      <ApiManagementTabs active="/admin/apis/categories" />
      <Card>
        <form action={saveApiIntegrationAction} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="returnTo" value="/admin/apis" />
          <SelectInput
            label="Provider"
            name="provider"
            defaultValue={defaultTemplate.provider}
            options={templates.map((template) => ({ value: template.provider, label: template.displayName }))}
          />
          <SelectInput
            label="Category"
            name="category"
            defaultValue={defaultTemplate.category}
            options={[...new Set(templates.map((template) => template.category))].map((category) => ({ value: category, label: categoryLabel(category) }))}
          />
          <TextInput label="Display name" name="displayName" defaultValue={defaultTemplate.displayName} required />
          <SelectInput label="Status" name="status" defaultValue={IntegrationStatus.draft} options={Object.values(IntegrationStatus).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <SelectInput label="Environment" name="environment" defaultValue={IntegrationEnvironment.production} options={Object.values(IntegrationEnvironment).map((value) => ({ value, label: value }))} />
          <TextInput label="Country scope (optional)" name="countryCode" maxLength={2} placeholder="US" />
          <TextInput label="Region/state scope (optional)" name="region" placeholder="TX" />
          <TextArea label="Description" name="description" defaultValue={defaultTemplate.description} />
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isGlobal" defaultChecked className="h-4 w-4" /> Global fallback configuration
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isDefault" className="h-4 w-4" /> Default match for this provider
          </label>
          <div className="md:col-span-2"><Button type="submit">Create API record</Button></div>
        </form>
      </Card>
    </AdminShell>
  );
}
