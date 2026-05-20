import Link from "next/link";
import { IntegrationEnvironment, IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextInput } from "@/components/ui/text-input";
import { requirePlatformRole } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getPublicIntegrationConfig, listPlatformIntegrations } from "@/server/config/platform-config-service";
import {
  runPlatformIntegrationTestAction,
  savePlatformIntegrationAction,
  savePlatformIntegrationCredentialAction,
  savePlatformIntegrationSettingAction,
} from "../../actions";

export const dynamic = "force-dynamic";

function stringSetting(
  settings: Array<{ settingKey: string; settingValueJson: unknown }>,
  key: string,
) {
  const value = settings.find((setting) => setting.settingKey === key)?.settingValueJson;
  return typeof value === "string" ? value : "";
}

function booleanSetting(
  settings: Array<{ settingKey: string; settingValueJson: unknown }>,
  key: string,
  fallback: boolean,
) {
  const value = settings.find((setting) => setting.settingKey === key)?.settingValueJson;
  return typeof value === "boolean" ? value : fallback;
}

function defaultTypeSetting(settings: Array<{ settingKey: string; settingValueJson: unknown }>) {
  const value = settings.find((setting) => setting.settingKey === "defaultOrganizationType")?.settingValueJson;
  return typeof value === "string" ? value : "household";
}

export default async function FacebookAuthConfigurationPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const [params, integrations, publicConfig] = await Promise.all([
    searchParams,
    listPlatformIntegrations(session),
    getPublicIntegrationConfig(IntegrationProvider.facebook_oauth),
  ]);
  const integration = integrations.find((item) => item.provider === "facebook_oauth");
  const callbackUrl = stringSetting(integration?.settings ?? [], "callbackUrl") || new URL("/api/auth/oauth/facebook/callback", env.APP_URL).toString();
  const returnTo = "/admin/configuration/auth/facebook";
  const canManage = ["platform_owner", "platform_admin", "country_manager"].includes(session.user.platformRole ?? "");
  const canEditSecrets = ["platform_owner", "platform_admin"].includes(session.user.platformRole ?? "");

  return (
    <AdminShell
      session={session}
      title="Facebook OAuth"
      description="Manage Facebook social sign-in, callback URLs, app credentials, auto-create behavior, and login button visibility."
    >
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-ink)]">Callback URL</h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Configure this exact callback in your Facebook app:
              <br />
              <code>{callbackUrl}</code>
            </p>
          </div>
          <Badge tone={integration?.status === "active" ? "success" : "warning"}>
            {integration?.status ?? "not configured"}
          </Badge>
        </div>
      </Card>

      {!integration ? (
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Create provider record</h2>
          {canManage ? (
            <form action={savePlatformIntegrationAction} className="mt-5 grid gap-4 md:grid-cols-2">
              <input type="hidden" name="provider" value="facebook_oauth" />
              <input type="hidden" name="category" value="auth" />
              <input type="hidden" name="displayName" value="Facebook OAuth" />
              <input type="hidden" name="description" value="Facebook social sign-in configuration" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <SelectInput label="Status" name="status" defaultValue={IntegrationStatus.active} options={Object.values(IntegrationStatus).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
              <SelectInput label="Environment" name="environment" defaultValue={IntegrationEnvironment.production} options={Object.values(IntegrationEnvironment).map((value) => ({ value, label: value }))} />
              <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
                <input type="checkbox" name="isGlobal" defaultChecked className="h-4 w-4" /> Global default
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
                <input type="checkbox" name="isDefault" defaultChecked className="h-4 w-4" /> Preferred provider record
              </label>
              <div className="md:col-span-2"><Button type="submit">Create Facebook OAuth config</Button></div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-muted)]">You have read-only access to OAuth configuration.</p>
          )}
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-ink)]">Provider controls</h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Use the full vault detail page when you need country-scoped overrides or extra operational notes.
                </p>
              </div>
              <Link href={`/admin/configuration/integrations/${integration.id}`} className="text-sm font-semibold text-[var(--color-primary)]">
                Open full vault detail
              </Link>
            </div>

            {canManage ? (
              <form action={savePlatformIntegrationAction} className="mt-5 grid gap-4 md:grid-cols-2">
                <input type="hidden" name="id" value={integration.id} />
                <input type="hidden" name="provider" value="facebook_oauth" />
                <input type="hidden" name="category" value="auth" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <TextInput label="Display name" name="displayName" defaultValue={integration.displayName} required />
                <SelectInput label="Status" name="status" defaultValue={integration.status} options={Object.values(IntegrationStatus).map((value) => ({ value, label: value.replace(/_/g, " ") }))} />
                <SelectInput label="Environment" name="environment" defaultValue={integration.environment} options={Object.values(IntegrationEnvironment).map((value) => ({ value, label: value }))} />
                <TextInput label="Country override" name="countryCode" defaultValue={integration.countryCode ?? ""} maxLength={2} />
                <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
                  <input type="checkbox" name="isGlobal" defaultChecked={integration.isGlobal} className="h-4 w-4" /> Global fallback
                </label>
                <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
                  <input type="checkbox" name="isDefault" defaultChecked={integration.isDefault} className="h-4 w-4" /> Preferred provider record
                </label>
                <div className="md:col-span-2"><Button type="submit">Save provider controls</Button></div>
              </form>
            ) : (
              <p className="mt-4 text-sm text-[var(--color-muted)]">You have read-only access to provider controls.</p>
            )}
          </Card>

          <section className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">Credentials</h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">Secrets stay encrypted at rest and never appear in clear text after save.</p>
              {canEditSecrets ? (
                <>
                  <form action={savePlatformIntegrationCredentialAction} className="mt-5 grid gap-4">
                    <input type="hidden" name="integrationId" value={integration.id} />
                    <input type="hidden" name="keyName" value="app_id" />
                    <input type="hidden" name="isPublicClientValue" value="true" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <TextInput label="Facebook app ID" name="secretValue" required />
                    <Button type="submit" variant="secondary">Save app ID</Button>
                  </form>
                  <form action={savePlatformIntegrationCredentialAction} className="mt-4 grid gap-4">
                    <input type="hidden" name="integrationId" value={integration.id} />
                    <input type="hidden" name="keyName" value="app_secret" />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <TextInput label="Facebook app secret" name="secretValue" type="password" required />
                    <Button type="submit">Save encrypted app secret</Button>
                  </form>
                </>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-muted)]">Only Platform Owner and Platform Admin can edit OAuth secrets.</p>
              )}
            </Card>

            <Card>
              <h2 className="text-base font-semibold text-[var(--color-ink)]">OAuth behavior</h2>
              <div className="mt-5 grid gap-4">
                {canManage ? (
                  <>
                    <form action={savePlatformIntegrationSettingAction} className="grid gap-3">
                      <input type="hidden" name="integrationId" value={integration.id} />
                      <input type="hidden" name="settingKey" value="callbackUrl" />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <TextInput label="Callback URL" name="settingValueText" defaultValue={callbackUrl} required />
                      <Button type="submit" variant="secondary">Save callback URL</Button>
                    </form>
                    <form action={savePlatformIntegrationSettingAction} className="grid gap-3 md:grid-cols-2">
                      <input type="hidden" name="integrationId" value={integration.id} />
                      <input type="hidden" name="settingKey" value="defaultOrganizationType" />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <SelectInput
                        label="Default account type"
                        name="settingValueText"
                        defaultValue={defaultTypeSetting(integration.settings)}
                        options={[
                          { value: "household", label: "Household" },
                          { value: "chef", label: "Home Chef" },
                          { value: "catering", label: "Home Catering" },
                          { value: "restaurant", label: "Restaurant Partner" },
                        ]}
                      />
                      <Button type="submit" variant="secondary" className="self-end">Save default type</Button>
                    </form>
                    {[
                  {
                    key: "autoCreateUser",
                    label: "Auto-create user accounts",
                    checked: booleanSetting(integration.settings, "autoCreateUser", true),
                  },
                  {
                    key: "loginButtonVisible",
                    label: "Show Facebook button on login/register",
                    checked: booleanSetting(integration.settings, "loginButtonVisible", true),
                  },
                    ].map((setting) => (
                      <form action={savePlatformIntegrationSettingAction} className="rounded-2xl border border-[var(--color-border)] p-4" key={setting.key}>
                        <input type="hidden" name="integrationId" value={integration.id} />
                        <input type="hidden" name="settingKey" value={setting.key} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <label className="flex items-center justify-between gap-3 text-sm font-medium text-[var(--color-ink)]">
                          <span>{setting.label}</span>
                          <input type="hidden" name="settingValueText" value={setting.checked ? "false" : "true"} />
                          <Button type="submit" variant="secondary">
                            {setting.checked ? "Disable" : "Enable"}
                          </Button>
                        </label>
                      </form>
                    ))}
                  </>
                ) : <p className="text-sm text-[var(--color-muted)]">You have read-only access to OAuth behavior settings.</p>}
              </div>
            </Card>
          </section>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-ink)]">Public login button state</h2>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Button visible: <strong>{publicConfig ? "yes" : "no"}</strong>
                </p>
              </div>
              {canManage ? (
                <form action={runPlatformIntegrationTestAction}>
                  <input type="hidden" name="integrationId" value={integration.id} />
                  <input type="hidden" name="testType" value="oauth_config" />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Button type="submit">Test configuration</Button>
                </form>
              ) : null}
            </div>
          </Card>
        </>
      )}
    </AdminShell>
  );
}
