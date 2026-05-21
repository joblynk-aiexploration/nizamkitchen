import { IntegrationEnvironment, IntegrationStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  getIntegrationTemplate,
  getPlatformIntegration,
  platformConfigurationOperationalStatus,
} from "@/server/config/platform-config-service";
import { ApiManagementTabs, providerLabel, scopeLabel, StatusBadge } from "../_components";
import {
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
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const integration = await getPlatformIntegration(session, id);
  const template = getIntegrationTemplate(integration.provider);
  const status = platformConfigurationOperationalStatus();
  const returnTo = `/admin/apis/${integration.id}`;

  return (
    <AdminShell
      session={session}
      title={integration.displayName}
      description="Owner-only API configuration for status, scope, encrypted credentials, callback URLs, webhooks, and safe tests."
    >
      <ApiManagementTabs active="/admin/apis/categories" />
      {query.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{query.message}</Card> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Provider</p><p className="mt-3 text-xl font-semibold">{providerLabel(integration.provider)}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Environment</p><p className="mt-3 text-xl font-semibold">{integration.environment}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Scope</p><p className="mt-3 text-xl font-semibold">{scopeLabel(integration)}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last test</p><p className="mt-3 text-xl font-semibold">{integration.lastTestStatus.replace(/_/g, " ")}</p></Card>
      </section>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">API status and scope</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{template.description}</p>
          </div>
          <StatusBadge status={integration.status} />
        </div>
        <form action={saveApiIntegrationAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={integration.id} />
          <input type="hidden" name="provider" value={integration.provider} />
          <input type="hidden" name="category" value={integration.category} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <TextInput label="Display name" name="displayName" defaultValue={integration.displayName} required />
          <SelectInput label="Environment" name="environment" defaultValue={integration.environment} options={Object.values(IntegrationEnvironment).map((value) => ({ value, label: value }))} />
          <SelectInput label="Status" name="status" defaultValue={integration.status} options={Object.values(IntegrationStatus).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
          <TextInput label="Country override" name="countryCode" defaultValue={integration.countryCode ?? ""} maxLength={2} />
          <TextInput label="Region override" name="region" defaultValue={integration.region ?? ""} />
          <TextArea label="Description" name="description" defaultValue={integration.description ?? ""} />
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isGlobal" defaultChecked={integration.isGlobal} className="h-4 w-4" /> Global fallback
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isDefault" defaultChecked={integration.isDefault} className="h-4 w-4" /> Default match
          </label>
          <div className="md:col-span-2"><Button type="submit">Save API</Button></div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Credentials</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">Full secrets are encrypted and never displayed after save. Public-client values must be intentionally marked.</p>
          </div>
          <Badge tone={status.encryptionConfigured ? "success" : "warning"}>{status.encryptionConfigured ? "Encryption ready" : "ENCRYPTION_KEY missing"}</Badge>
        </div>
        <div className="mt-4 grid gap-3">
          {integration.credentials.length ? integration.credentials.map((credential) => (
            <div key={credential.id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{credential.keyName}</p>
                  <p className="text-sm text-[var(--color-muted)]">{credential.valuePreview}</p>
                </div>
                <Badge tone={credential.isPublicClientValue ? "warning" : "success"}>
                  {credential.isPublicClientValue ? "Public client value" : "Server-only secret"}
                </Badge>
              </div>
            </div>
          )) : <p className="text-sm text-[var(--color-muted)]">No credentials saved yet.</p>}
        </div>
        <form action={saveApiCredentialAction} className="mt-6 grid gap-4 md:grid-cols-3">
          <input type="hidden" name="integrationId" value={integration.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <TextInput label="Key name" name="keyName" placeholder={template.serverCredentialKeys[0] ?? template.publicCredentialKeys[0] ?? "api_key"} required />
          <TextInput label="Value" name="secretValue" type="password" required />
          <label className="flex items-end gap-3 text-sm font-medium text-[var(--color-ink)]">
            <input type="checkbox" name="isPublicClientValue" className="h-4 w-4" /> Browser-safe public key
          </label>
          <div className="md:col-span-3"><Button type="submit">Save / rotate credential</Button></div>
        </form>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Settings, callback URLs, and webhook URLs</h2>
          <div className="mt-4 space-y-3">
            {integration.settings.length ? integration.settings.map((setting) => (
              <div key={setting.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                <p className="font-semibold text-[var(--color-ink)]">{setting.settingKey}</p>
                <pre className="mt-2 overflow-x-auto text-xs text-[var(--color-muted)]">{JSON.stringify(setting.settingValueJson, null, 2)}</pre>
              </div>
            )) : <p className="text-sm text-[var(--color-muted)]">No settings saved yet. Add callback URLs, webhook URLs, allowed countries, IDs, or provider-specific flags here.</p>}
          </div>
          <form action={saveApiSettingAction} className="mt-6 grid gap-4">
            <input type="hidden" name="integrationId" value={integration.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <TextInput label="Setting key" name="settingKey" placeholder={template.settings[0]?.key ?? "callbackUrl"} required />
            <TextInput label="Plain text value" name="settingValueText" placeholder={template.settings[0]?.example ?? "https://app.example.com/callback"} />
            <TextArea label="JSON value (optional)" name="settingValueJson" placeholder={`{"enabled":true}`} />
            <div><Button type="submit">Save setting</Button></div>
          </form>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Suggested setup fields</h2>
          <div className="mt-4 space-y-3 text-sm text-[var(--color-muted)]">
            <p><strong className="text-[var(--color-ink)]">Public keys:</strong> {template.publicCredentialKeys.join(", ") || "none"}</p>
            <p><strong className="text-[var(--color-ink)]">Server secrets:</strong> {template.serverCredentialKeys.join(", ") || "none"}</p>
            {template.settings.map((setting) => (
              <div key={setting.key} className="rounded-2xl border border-[var(--color-border)] p-4">
                <p className="font-semibold text-[var(--color-ink)]">{setting.key}</p>
                <p className="mt-1">{setting.description}</p>
                {setting.example ? <p className="mt-1 text-xs">Example: <code>{setting.example}</code></p> : null}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Safe API tests</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Tests validate configuration shape and readiness without creating charges, sending secrets to the browser, or logging secret values.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {(template.supportedTestTypes.length ? template.supportedTestTypes : ["configuration_check"]).map((testType) => (
            <form action={runApiTestAction} key={testType}>
              <input type="hidden" name="integrationId" value={integration.id} />
              <input type="hidden" name="testType" value={testType} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="secondary">Test {testType.replace(/_/g, " ")}</Button>
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
                </div>
                <StatusBadge status={log.status} />
              </div>
            </div>
          )) : <p className="text-sm text-[var(--color-muted)]">No tests logged yet.</p>}
        </div>
      </Card>
    </AdminShell>
  );
}
