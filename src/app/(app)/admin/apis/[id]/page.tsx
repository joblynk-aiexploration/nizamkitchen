import { IntegrationEnvironment, IntegrationStatus, type Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  generatedProviderValue,
  getProviderFields,
  getProviderFormDefinition,
  requiredProviderFields,
  type ProviderFieldDefinition,
} from "@/lib/integrations/provider-fields";
import { isLocalhostUrl } from "@/lib/app-url";
import { getPublicOriginFromHeaders } from "@/lib/request-origin";
import {
  getIntegrationReadiness,
  platformConfigurationOperationalStatus,
  type RedactedPlatformIntegration,
} from "@/server/config/platform-config-service";
import { ApiManagementTabs, categoryLabel, providerLabel, scopeLabel, StatusBadge } from "../_components";
import {
  deleteApiIntegrationAction,
  runApiTestAction,
  saveApiCredentialAction,
  saveApiIntegrationAction,
  saveApiSettingAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ApiIntegrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner"]);
  const [{ id }, query, headerList] = await Promise.all([params, searchParams, headers()]);
  const appOrigin = getPublicOriginFromHeaders(headerList);
  const readiness = await getIntegrationReadiness(session, id);
  const { integration, template } = readiness;
  const providerForm = getProviderFormDefinition(integration.provider);
  const status = platformConfigurationOperationalStatus();
  const returnTo = `/admin/apis/${integration.id}`;
  const basicFields = getProviderFields(integration.provider, false);
  const advancedFields = getProviderFields(integration.provider, true);
  const credentialMap = new Map(integration.credentials.map((credential) => [credential.keyName, credential]));
  const settingMap = new Map(integration.settings.map((setting) => [setting.settingKey, setting]));
  const missingRequiredFields = requiredProviderFields(integration.provider).filter((field) => {
    if (field.kind === "credential") return !credentialMap.has(field.key);
    return !settingMap.has(field.key);
  });
  const canRunTest = integration.status === IntegrationStatus.active && missingRequiredFields.length === 0;
  const generatedCallbackUrl = providerForm.generatedCallbackPath
    ? new URL(providerForm.generatedCallbackPath, appOrigin).toString()
    : null;
  const generatedWebhookUrl = providerForm.generatedWebhookPath
    ? new URL(providerForm.generatedWebhookPath, appOrigin).toString()
    : null;
  const savedCallbackUrl = settingMap.get("callbackUrl")?.settingValueJson;
  const savedCallbackIsLocalhost = typeof savedCallbackUrl === "string" && isLocalhostUrl(savedCallbackUrl);
  const currentOriginIsLocalhost = isLocalhostUrl(appOrigin);

  return (
    <AdminShell
      session={session}
      title={integration.displayName}
      description="Provider-specific API setup. Only the fields this provider needs are shown, and saved secrets stay masked."
    >
      <ApiManagementTabs active="/admin/apis/categories" />
      <FormMessage message={query.message} />

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Provider" value={providerForm.displayName || providerLabel(integration.provider)} />
        <SummaryCard label="Category" value={categoryLabel(integration.category)} />
        <SummaryCard label="Environment" value={integration.environment} />
        <SummaryCard label="Scope" value={scopeLabel(integration)} />
      </section>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Setup guide</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{providerForm.displayName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">{providerForm.setupGuide}</p>
          </div>
          <StatusBadge status={configurationStatus(integration, missingRequiredFields)} />
        </div>
        {generatedCallbackUrl || generatedWebhookUrl ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {generatedCallbackUrl ? (
              <GeneratedUrlCard label="Authorized callback URL" value={generatedCallbackUrl} />
            ) : null}
            {generatedWebhookUrl ? (
              <GeneratedUrlCard label="Webhook URL" value={generatedWebhookUrl} />
            ) : null}
          </div>
        ) : null}
        {savedCallbackIsLocalhost && !currentOriginIsLocalhost ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
            This saved callback URL points to localhost and will not work in production. Re-save the generated callback URL shown above, then add that exact URL in the provider dashboard.
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Basic setup</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Enable/disable this API, choose the environment, and control whether it applies globally or to a specific country.
            </p>
          </div>
          <StatusBadge status={integration.status} />
        </div>
        <form action={saveApiIntegrationAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={integration.id} />
          <input type="hidden" name="provider" value={integration.provider} />
          <input type="hidden" name="category" value={integration.category} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <TextInput label="Display name" name="displayName" defaultValue={integration.displayName} required />
          <SelectInput
            label="Enabled"
            name="status"
            defaultValue={integration.status}
            options={[
              { value: IntegrationStatus.active, label: "Enabled" },
              { value: IntegrationStatus.disabled, label: "Disabled" },
              { value: IntegrationStatus.draft, label: "Draft" },
              { value: IntegrationStatus.error, label: "Error" },
            ]}
          />
          <SelectInput
            label="Environment"
            name="environment"
            defaultValue={integration.environment}
            options={Object.values(IntegrationEnvironment).map((value) => ({ value, label: value.replace(/_/g, " ") }))}
          />
          <TextInput label="Country scope" name="countryCode" defaultValue={integration.countryCode ?? ""} maxLength={2} placeholder="US" />
          <TextInput label="Region/state scope" name="region" defaultValue={integration.region ?? ""} placeholder="TX" />
          <TextArea label="Description" name="description" defaultValue={integration.description ?? providerForm.description} />
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isGlobal" defaultChecked={integration.isGlobal} className="h-4 w-4" /> Global fallback
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isDefault" defaultChecked={integration.isDefault} className="h-4 w-4" /> Default match
          </label>
          <div className="md:col-span-2"><Button type="submit">Save API settings</Button></div>
        </form>
      </Card>

      <ProviderFieldsSection
        title="Required credentials and settings"
        description={`Only the fields needed for ${providerForm.displayName} are shown here. Secrets are encrypted and never displayed after save.`}
        fields={basicFields}
        integration={integration}
        credentialMap={credentialMap}
        settingMap={settingMap}
        appOrigin={appOrigin}
        returnTo={returnTo}
        encryptionReady={status.encryptionConfigured}
      />

      {advancedFields.length > 0 ? (
        <details className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-base font-semibold text-[var(--color-ink)]">Advanced settings</summary>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Optional provider behavior. Leave these blank unless this API provider specifically requires them.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {advancedFields.map((field) => (
              <ProviderFieldEditor
                key={`${field.kind}:${field.key}`}
                field={field}
                integration={integration}
                savedCredential={credentialMap.get(field.key)}
                savedSetting={settingMap.get(field.key)}
                appOrigin={appOrigin}
                returnTo={returnTo}
              />
            ))}
          </div>
        </details>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Test connection</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">{providerForm.testDescription}</p>
            {!canRunTest ? (
              <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
                {integration.status !== IntegrationStatus.active
                  ? "Enable this API before testing."
                  : `Missing required fields: ${missingRequiredFields.map((field) => field.label).join(", ")}.`}
              </p>
            ) : null}
          </div>
          <Badge tone={status.encryptionConfigured ? "success" : "warning"}>
            {status.encryptionConfigured ? "Secret storage ready" : "Encryption setup needed"}
          </Badge>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {(template.supportedTestTypes.length ? template.supportedTestTypes : ["configuration_check"]).map((testType) => (
            <form action={runApiTestAction} key={testType}>
              <input type="hidden" name="integrationId" value={integration.id} />
              <input type="hidden" name="testType" value={testType} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="secondary" disabled={!canRunTest}>
                Test {testType.replace(/_/g, " ")}
              </Button>
            </form>
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {integration.testLogs.length ? integration.testLogs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{log.testType.replace(/_/g, " ")}</p>
                  <p className="text-sm text-[var(--color-muted)]">{log.message}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{log.createdAt.toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
                </div>
                <StatusBadge status={log.status} />
              </div>
            </div>
          )) : <p className="text-sm text-[var(--color-muted)]">No API tests have been logged yet.</p>}
        </div>
      </Card>

      <details className="rounded-3xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-base font-semibold text-[var(--color-ink)]">Developer details</summary>
        <div className="mt-4 grid gap-4 text-sm text-[var(--color-muted)] md:grid-cols-2">
          <p><strong className="text-[var(--color-ink)]">Provider:</strong> {integration.provider}</p>
          <p><strong className="text-[var(--color-ink)]">Category:</strong> {integration.category}</p>
          <p><strong className="text-[var(--color-ink)]">Created:</strong> {integration.createdAt.toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
          <p><strong className="text-[var(--color-ink)]">Updated:</strong> {integration.updatedAt.toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
        </div>
        <div className="mt-5 space-y-3">
          {integration.settings.length ? integration.settings.map((setting) => (
            <div key={setting.id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <p className="font-semibold text-[var(--color-ink)]">{setting.settingKey}</p>
              <pre className="mt-2 overflow-x-auto text-xs text-[var(--color-muted)]">{safeSettingPreview(setting.settingValueJson)}</pre>
            </div>
          )) : <p className="text-sm text-[var(--color-muted)]">No optional settings saved yet.</p>}
        </div>
      </details>

      <details className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <summary className="cursor-pointer text-base font-semibold text-red-950">Danger zone</summary>
        <p className="mt-2 text-sm text-red-900">
          Delete this API only if it is no longer used. Saved encrypted credentials and settings for this integration will be removed.
        </p>
        <form action={deleteApiIntegrationAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="integrationId" value={integration.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <TextInput label="Type DELETE to confirm" name="confirmation" placeholder="DELETE" />
          <Button type="submit" variant="destructive">Delete API</Button>
        </form>
      </details>
    </AdminShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-semibold capitalize text-[var(--color-ink)]">{value}</p>
    </Card>
  );
}

function GeneratedUrlCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">{label}</p>
      <code className="mt-2 block overflow-x-auto rounded-xl bg-white px-3 py-2 text-xs text-emerald-950">{value}</code>
    </div>
  );
}

function ProviderFieldsSection({
  title,
  description,
  fields,
  integration,
  credentialMap,
  settingMap,
  appOrigin,
  returnTo,
  encryptionReady,
}: {
  title: string;
  description: string;
  fields: ProviderFieldDefinition[];
  integration: RedactedPlatformIntegration;
  credentialMap: Map<string, RedactedPlatformIntegration["credentials"][number]>;
  settingMap: Map<string, RedactedPlatformIntegration["settings"][number]>;
  appOrigin: string;
  returnTo: string;
  encryptionReady: boolean;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-muted)]">{description}</p>
        </div>
        <Badge tone={encryptionReady ? "success" : "warning"}>{encryptionReady ? "Encrypted at rest" : "Encryption setup needed"}</Badge>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {fields.length ? fields.map((field) => (
          <ProviderFieldEditor
            key={`${field.kind}:${field.key}`}
            field={field}
            integration={integration}
            savedCredential={credentialMap.get(field.key)}
            savedSetting={settingMap.get(field.key)}
            appOrigin={appOrigin}
            returnTo={returnTo}
          />
        )) : <p className="text-sm text-[var(--color-muted)]">This provider does not require any manual fields.</p>}
      </div>
    </Card>
  );
}

function ProviderFieldEditor({
  field,
  integration,
  savedCredential,
  savedSetting,
  appOrigin,
  returnTo,
}: {
  field: ProviderFieldDefinition;
  integration: RedactedPlatformIntegration;
  savedCredential?: RedactedPlatformIntegration["credentials"][number];
  savedSetting?: RedactedPlatformIntegration["settings"][number];
  appOrigin: string;
  returnTo: string;
}) {
  if (field.kind === "credential") {
    return (
      <form action={saveApiCredentialAction} className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
        <input type="hidden" name="integrationId" value={integration.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="keyName" value={field.key} />
        {field.publicClient ? <input type="hidden" name="isPublicClientValue" value="true" /> : null}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[var(--color-ink)]">
              {field.label}{field.required ? " *" : ""}
            </p>
            {savedCredential ? (
              <p className="mt-1 text-sm text-[var(--color-muted)]">Saved preview: {savedCredential.valuePreview}</p>
            ) : (
              <p className="mt-1 text-sm text-[var(--color-muted)]">Not saved yet.</p>
            )}
          </div>
          <Badge tone={field.publicClient ? "warning" : "success"}>
            {field.publicClient ? "Public client value" : "Server-only secret"}
          </Badge>
        </div>
        <TextInput
          label={savedCredential ? `Replace ${field.label}` : field.label}
          name="secretValue"
          type={field.secret ? "password" : "text"}
          placeholder={savedCredential ? "Enter a new value to rotate" : field.placeholder}
          required={!savedCredential && field.required}
          hint={field.helpText ?? credentialHint(field)}
        />
        <div className="mt-4">
          <Button type="submit" variant={savedCredential ? "secondary" : "primary"}>
            {savedCredential ? "Replace saved value" : "Save value"}
          </Button>
        </div>
      </form>
    );
  }

  const generatedValue = field.readOnlyGenerated
    ? generatedProviderValue(integration.provider, field.key, appOrigin)
    : "";
  const savedValue = field.readOnlyGenerated
    ? generatedValue
    : settingValueToString(savedSetting?.settingValueJson);

  return (
    <form action={saveApiSettingAction} className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
      <input type="hidden" name="integrationId" value={integration.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="settingKey" value={field.key} />
      <ProviderSettingInput field={field} value={savedValue} />
      <div className="mt-4">
        <Button type="submit" variant={savedSetting ? "secondary" : "primary"}>
          {savedSetting ? "Save setting" : "Add setting"}
        </Button>
      </div>
    </form>
  );
}

function ProviderSettingInput({ field, value }: { field: ProviderFieldDefinition; value: string }) {
  const hint = field.helpText ?? (field.publicClient ? "Public value. It may be visible in the browser; restrict it in the provider dashboard." : undefined);

  if (field.type === "select" && field.options) {
    return (
      <SelectInput
        label={`${field.label}${field.required ? " *" : ""}`}
        name="settingValueText"
        defaultValue={value || field.placeholder || field.options[0]?.value}
        required={field.required}
        hint={hint}
        options={field.options}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <TextArea
        label={`${field.label}${field.required ? " *" : ""}`}
        name="settingValueText"
        defaultValue={value}
        required={field.required}
        placeholder={field.placeholder}
        hint={hint}
      />
    );
  }

  return (
    <TextInput
      label={`${field.label}${field.required ? " *" : ""}`}
      name="settingValueText"
      type={field.type ?? "text"}
      defaultValue={value}
      required={field.required}
      readOnly={field.readOnlyGenerated}
      placeholder={field.placeholder}
      hint={hint}
    />
  );
}

function settingValueToString(value: Prisma.JsonValue | undefined) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function safeSettingPreview(value: Prisma.JsonValue) {
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}...`;
  return JSON.stringify(value, null, 2);
}

function credentialHint(field: ProviderFieldDefinition) {
  if (field.publicClient) {
    return "Public value. It may be visible in the browser; restrict it in the provider dashboard.";
  }

  return "Server-only secret. Never exposed to the browser.";
}

function configurationStatus(integration: RedactedPlatformIntegration, missingRequiredFields: ProviderFieldDefinition[]) {
  if (integration.status === IntegrationStatus.disabled) return "Disabled";
  if (integration.status === IntegrationStatus.error) return "Error";
  if (missingRequiredFields.length === requiredProviderFields(integration.provider).length) return "Not configured";
  if (missingRequiredFields.length) return "Missing required fields";
  if (integration.status === IntegrationStatus.active) return "Active";
  return "Ready to test";
}
