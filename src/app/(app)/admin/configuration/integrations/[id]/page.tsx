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
import {
  runPlatformIntegrationTestAction,
  savePlatformIntegrationAction,
  savePlatformIntegrationCredentialAction,
  savePlatformIntegrationSettingAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function PlatformIntegrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const integration = await getPlatformIntegration(session, id);
  const template = getIntegrationTemplate(integration.provider);
  const status = platformConfigurationOperationalStatus();
  const canManage = ["platform_owner", "platform_admin", "country_manager"].includes(session.user.platformRole ?? "");
  const canViewSecretPreview = ["platform_owner", "platform_admin", "country_manager"].includes(session.user.platformRole ?? "");
  const canEditSecrets = ["platform_owner", "platform_admin"].includes(session.user.platformRole ?? "");

  return (
    <AdminShell
      session={session}
      title={integration.displayName}
      description="Edit provider status, country scope, masked credentials, and provider settings without exposing full secret values."
    >
      {query.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{query.message}</Card> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Provider</p><p className="mt-3 text-xl font-semibold">{integration.provider.replace(/_/g, " ")}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Environment</p><p className="mt-3 text-xl font-semibold">{integration.environment}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Scope</p><p className="mt-3 text-xl font-semibold">{integration.countryCode ?? "global"}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last test</p><p className="mt-3 text-xl font-semibold">{integration.lastTestStatus.replace(/_/g, " ")}</p></Card>
      </section>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Integration settings</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{template.description}</p>
          </div>
          <Badge tone={integration.status === IntegrationStatus.active ? "success" : integration.status === IntegrationStatus.error ? "danger" : "warning"}>
            {integration.status}
          </Badge>
        </div>
        {canManage ? (
          <form action={savePlatformIntegrationAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={integration.id} />
            <input type="hidden" name="provider" value={integration.provider} />
            <input type="hidden" name="category" value={integration.category} />
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
            <div className="md:col-span-2"><Button type="submit">Save integration</Button></div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-muted)]">You have read-only access to this integration.</p>
        )}
      </Card>

      {canViewSecretPreview ? (
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">Masked credentials</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Secrets are encrypted at rest and never shown after save.</p>
            </div>
            <Badge tone={status.encryptionConfigured ? "success" : "warning"}>
              {status.encryptionConfigured ? "Encryption ready" : "ENCRYPTION_KEY missing"}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3">
            {integration.credentials.length ? integration.credentials.map((credential) => (
              <div key={credential.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-ink)]">{credential.keyName}</p>
                    <p className="text-sm text-[var(--color-muted)]">{credential.valuePreview}</p>
                  </div>
                  <Badge tone={credential.isPublicClientValue ? "warning" : "success"}>
                    {credential.isPublicClientValue ? "Public client value" : "Server secret"}
                  </Badge>
                </div>
              </div>
            )) : <p className="text-sm text-[var(--color-muted)]">No credentials saved yet.</p>}
          </div>
          {canEditSecrets ? (
            <form action={savePlatformIntegrationCredentialAction} className="mt-6 grid gap-4 md:grid-cols-3">
              <input type="hidden" name="integrationId" value={integration.id} />
              <TextInput label="Key name" name="keyName" placeholder={template.serverCredentialKeys[0] ?? template.publicCredentialKeys[0] ?? "api_key"} required />
              <TextInput label="Value" name="secretValue" type="password" required />
              <label className="flex items-end gap-3 text-sm font-medium text-[var(--color-ink)]">
                <input type="checkbox" name="isPublicClientValue" className="h-4 w-4" /> Mark as browser-safe public value
              </label>
              <div className="md:col-span-3"><Button type="submit">Save encrypted credential</Button></div>
            </form>
          ) : null}
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Settings</h2>
          <div className="mt-4 space-y-3">
            {integration.settings.length ? integration.settings.map((setting) => (
              <div key={setting.id} className="rounded-2xl border border-[var(--color-border)] p-4">
                <p className="font-semibold text-[var(--color-ink)]">{setting.settingKey}</p>
                <pre className="mt-2 overflow-x-auto text-xs text-[var(--color-muted)]">{JSON.stringify(setting.settingValueJson, null, 2)}</pre>
              </div>
            )) : <p className="text-sm text-[var(--color-muted)]">No provider settings saved yet.</p>}
          </div>
          {canManage ? (
            <form action={savePlatformIntegrationSettingAction} className="mt-6 grid gap-4">
              <input type="hidden" name="integrationId" value={integration.id} />
              <TextInput label="Setting key" name="settingKey" placeholder={template.settings[0]?.key ?? "callbackUrl"} required />
              <TextInput label="Plain text value" name="settingValueText" placeholder={template.settings[0]?.example ?? "https://app.example.com/callback"} />
              <TextArea label="JSON value (optional)" name="settingValueJson" placeholder={`{"enabled":true}`} />
              <div><Button type="submit">Save setting</Button></div>
            </form>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Suggested fields</h2>
          <div className="mt-4 space-y-3 text-sm text-[var(--color-muted)]">
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
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Integration tests</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Safe configuration tests validate presence and scope now. Provider-specific live tests can be layered in later without changing this vault model.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {(template.supportedTestTypes.length ? template.supportedTestTypes : ["configuration_check"]).map((testType) => (
            <form action={runPlatformIntegrationTestAction} key={testType}>
              <input type="hidden" name="integrationId" value={integration.id} />
              <input type="hidden" name="testType" value={testType} />
              <Button type="submit" variant="secondary">Test {testType.replace(/_/g, " ")}</Button>
            </form>
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {integration.testLogs.length ? integration.testLogs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-[var(--color-border)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{log.testType.replace(/_/g, " ")}</p>
                  <p className="text-sm text-[var(--color-muted)]">{log.message}</p>
                </div>
                <Badge tone={log.status === "success" ? "success" : log.status === "failed" ? "danger" : "neutral"}>{log.status}</Badge>
              </div>
            </div>
          )) : <p className="text-sm text-[var(--color-muted)]">No tests logged yet.</p>}
        </div>
      </Card>
    </AdminShell>
  );
}
