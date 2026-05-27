import { IntegrationEnvironment, IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { headers } from "next/headers";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { FormMessage } from "@/components/ui/form-message";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  generatedProviderValue,
  getProviderFields,
  getProviderFormDefinition,
  type ProviderFieldDefinition,
} from "@/lib/integrations/provider-fields";
import { getPublicOriginFromHeaders } from "@/lib/request-origin";
import { getIntegrationTemplate, listIntegrationTemplates } from "@/server/config/platform-config-service";
import { ApiManagementTabs, categoryLabel } from "../_components";
import { createApiWithSetupAction } from "../actions";
import { ApiProviderPicker } from "./provider-picker";

export const dynamic = "force-dynamic";

function oauthSetupKeys(provider: IntegrationProvider) {
  if (provider === IntegrationProvider.facebook_oauth) {
    return ["FACEBOOK_OAUTH_APP_ID", "FACEBOOK_OAUTH_APP_SECRET", "FACEBOOK_OAUTH_CALLBACK_URL"];
  }

  return ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_CALLBACK_URL"];
}

function smtpSetupKeys() {
  return ["SMTP host", "SMTP port", "SMTP username", "SMTP password", "From email", "From name"];
}

export default async function NewApiIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner"]);
  const params = await searchParams;
  const appOrigin = getPublicOriginFromHeaders(await headers());
  const templates = listIntegrationTemplates();
  const selectedProvider = Object.values(IntegrationProvider).includes(params.provider as IntegrationProvider)
    ? (params.provider as IntegrationProvider)
    : IntegrationProvider.google_maps;
  const defaultTemplate = getIntegrationTemplate(selectedProvider);
  const providerForm = getProviderFormDefinition(selectedProvider);
  const basicFields = getProviderFields(selectedProvider, false);
  const advancedFields = getProviderFields(selectedProvider, true);
  const generatedCallbackUrl = providerForm.generatedCallbackPath
    ? new URL(providerForm.generatedCallbackPath, appOrigin).toString()
    : null;

  return (
    <AdminShell
      session={session}
      title="Add API"
      description="Choose the API type and enter only the credentials/settings that provider needs. Secrets are encrypted immediately after save."
    >
      <ApiManagementTabs active="/admin/apis/categories" />
      <FormMessage message={params.message} />
      {(selectedProvider === IntegrationProvider.google_oauth ||
        selectedProvider === IntegrationProvider.facebook_oauth) ? (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
          <strong>{defaultTemplate.displayName} setup:</strong> this page now saves only the OAuth values this provider needs.
          Enter {oauthSetupKeys(selectedProvider).map((key, index, keys) => (
            <span key={key}>
              <code>{key}</code>{index < keys.length - 1 ? ", " : "."}
            </span>
          ))}
        </Card>
      ) : null}
      {selectedProvider === IntegrationProvider.smtp ? (
        <Card className="border-emerald-200 bg-emerald-50 text-sm leading-6 text-emerald-900">
          <strong>SMTP setup:</strong> create one SMTP API per sender/provider. You can add multiple SMTP APIs and mark them
          <strong> active</strong> or <strong>passive</strong>. Active providers send first by priority; passive providers are used as backups if active delivery fails.
          Required fields: {smtpSetupKeys().join(", ")}.
        </Card>
      ) : null}
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <ApiProviderPicker
            selectedProvider={selectedProvider}
            options={templates.map((template) => ({ value: template.provider, label: template.displayName }))}
          />
          <div className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]">
            <p className="font-semibold text-[var(--color-ink)]">{providerForm.displayName}</p>
            <p className="mt-1">{providerForm.description}</p>
            <p className="mt-2 text-xs">Category: {categoryLabel(providerForm.category)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <form action={createApiWithSetupAction} className="grid gap-5">
          <input type="hidden" name="provider" value={providerForm.provider} />
          <input type="hidden" name="category" value={providerForm.category} />
          <input type="hidden" name="displayName" value={providerForm.displayName} />
          <input type="hidden" name="description" value={providerForm.description} />
          <input type="hidden" name="isGlobal" value="true" />
          <input type="hidden" name="isDefault" value="true" />
          {generatedCallbackUrl ? (
            <>
              <input type="hidden" name="settingKey" value="callbackUrl" />
              <input type="hidden" name="settingValue:callbackUrl" value={generatedCallbackUrl} />
            </>
          ) : null}

          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
            <h2 className="text-base font-semibold">Setup guide</h2>
            <p className="mt-2">{providerForm.setupGuide}</p>
            {generatedCallbackUrl ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Authorized callback URL</p>
                <code className="mt-2 block overflow-x-auto rounded-2xl bg-white px-3 py-2 text-xs text-emerald-950">{generatedCallbackUrl}</code>
              </div>
            ) : null}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <SelectInput label="Enabled" name="status" defaultValue={IntegrationStatus.active} options={[
              { value: IntegrationStatus.active, label: "Enabled" },
              { value: IntegrationStatus.disabled, label: "Disabled" },
            ]} />
            <SelectInput label="Environment" name="environment" defaultValue={IntegrationEnvironment.production} options={Object.values(IntegrationEnvironment).map((value) => ({ value, label: value }))} />
          </section>

          <section className="rounded-3xl border border-[var(--color-border)] bg-slate-50 p-5">
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Basic setup</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              These are the only required fields for {providerForm.displayName}. Server-only secrets are encrypted and never shown again.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {basicFields.filter((field) => !field.readOnlyGenerated).map((field) => (
                <ProviderFieldInput
                  key={`${field.kind}:${field.key}`}
                  field={field}
                  provider={selectedProvider}
                  appOrigin={appOrigin}
                />
              ))}
              {basicFields.filter((field) => !field.readOnlyGenerated).length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No required manual fields for this API type.</p>
              ) : null}
            </div>
          </section>

          {advancedFields.length > 0 ? (
            <details className="rounded-3xl border border-[var(--color-border)] bg-white p-5">
              <summary className="cursor-pointer text-base font-semibold text-[var(--color-ink)]">Advanced settings</summary>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Optional provider behavior. Leave these blank unless you need them.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {advancedFields.map((field) => (
                  <ProviderFieldInput
                    key={`${field.kind}:${field.key}`}
                    field={field}
                    provider={selectedProvider}
                    appOrigin={appOrigin}
                  />
                ))}
                <TextInput label="Country scope" name="countryCode" maxLength={2} placeholder="US" />
                <TextInput label="Region/state scope" name="region" placeholder="TX" />
              </div>
            </details>
          ) : null}

          <div>
            <Button type="submit">Create and save API</Button>
          </div>
        </form>
      </Card>
    </AdminShell>
  );
}

function ProviderFieldInput({
  field,
  provider,
  appOrigin,
  savedValue,
}: {
  field: ProviderFieldDefinition;
  provider: IntegrationProvider;
  appOrigin: string;
  savedValue?: string;
}) {
  const inputName = field.kind === "credential"
    ? `credentialValue:${field.key}`
    : `settingValue:${field.key}`;
  const defaultValue = field.readOnlyGenerated
    ? generatedProviderValue(provider, field.key, appOrigin)
    : savedValue ?? field.placeholder ?? "";
  const hint = field.helpText ??
    (field.publicClient
      ? "Public value. It may be visible in the browser; restrict it in the provider dashboard."
      : field.secret
        ? "Server-only secret. Never exposed to the browser."
        : undefined);

  return (
    <div>
      {field.kind === "credential" ? (
        <input type="hidden" name="credentialKey" value={field.key} />
      ) : (
        <input type="hidden" name="settingKey" value={field.key} />
      )}
      {field.kind === "credential" && field.publicClient ? (
        <input type="hidden" name={`isPublicClientValue:${field.key}`} value="true" />
      ) : null}
      {field.type === "select" && field.options ? (
        <SelectInput
          label={field.label}
          name={inputName}
          defaultValue={defaultValue}
          required={field.required}
          hint={hint}
          options={field.options}
        />
      ) : field.type === "textarea" ? (
        <TextArea
          label={field.label}
          name={inputName}
          defaultValue={defaultValue}
          required={field.required}
          hint={hint}
        />
      ) : (
        <TextInput
          label={field.label}
          name={inputName}
          type={field.type ?? (field.secret ? "password" : "text")}
          defaultValue={field.secret ? undefined : defaultValue}
          required={field.required}
          readOnly={field.readOnlyGenerated}
          hint={hint}
        />
      )}
    </div>
  );
}
