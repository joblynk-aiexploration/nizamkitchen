import Link from "next/link";
import { IntegrationStatus } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { requirePlatformRole } from "@/lib/auth/session";
import { requiredProviderFields } from "@/lib/integrations/provider-fields";
import {
  listIntegrationTemplates,
  listPlatformIntegrations,
  platformConfigurationOperationalStatus,
} from "@/server/config/platform-config-service";
import { ApiManagementTabs, categoryLabel, providerLabel, scopeLabel, StatusBadge } from "./_components";
import { importOAuthFromEnvAction, toggleOAuthSignInAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ApiManagementPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner"]);
  const [params, integrations] = await Promise.all([searchParams, listPlatformIntegrations(session)]);
  const templates = listIntegrationTemplates();
  const operationalStatus = platformConfigurationOperationalStatus();
  const activeCount = integrations.filter((integration) => integration.status === IntegrationStatus.active).length;
  const secretCount = integrations.reduce((total, integration) => total + integration.credentials.filter((credential) => !credential.isPublicClientValue).length, 0);
  const publicKeyCount = integrations.reduce((total, integration) => total + integration.credentials.filter((credential) => credential.isPublicClientValue).length, 0);
  const googleOAuth = integrations.find((integration) => integration.provider === "google_oauth");
  const facebookOAuth = integrations.find((integration) => integration.provider === "facebook_oauth");

  return (
    <AdminShell
      session={session}
      title="API Management"
      description="Platform Owner control for application APIs, encrypted credentials, public keys, webhooks, country scopes, and safe integration tests."
      actions={<Button asChild><Link href="/admin/apis/new">Add API</Link></Button>}
    >
      <ApiManagementTabs active="/admin/apis" />
      <FormMessage message={params.message} />

      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Configured APIs</p><p className="mt-3 text-2xl font-semibold">{integrations.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active APIs</p><p className="mt-3 text-2xl font-semibold">{activeCount}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Masked secrets</p><p className="mt-3 text-2xl font-semibold">{secretCount}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Public keys</p><p className="mt-3 text-2xl font-semibold">{publicKeyCount}</p></Card>
      </section>

      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Security posture</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Secrets are encrypted at rest with the server-only encryption system and full values are never shown after save.
          Public browser values must be explicitly marked as public-client values.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <StatusBadge status={operationalStatus.encryptionConfigured ? "success" : "failed"} />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Full secret reveal disabled</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{templates.length} supported templates</span>
        </div>
      </Card>

      <section id="social-sign-in" className="scroll-mt-6 grid gap-4 md:grid-cols-2">
        {[
          {
            name: "Google sign-in",
            description: "Configure the Google OAuth client ID, client secret, callback URL, and signup/login visibility.",
            integration: googleOAuth,
            provider: "google_oauth",
          },
          {
            name: "Facebook sign-in",
            description: "Configure the Facebook OAuth app ID, app secret, callback URL, and signup/login visibility.",
            integration: facebookOAuth,
            provider: "facebook_oauth",
          },
        ].map((item) => {
          const isVisibleToUsers = item.integration ? isSocialSignInVisible(item.integration) : false;

          return (
          <Card key={item.provider} className="flex flex-col justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-[var(--color-ink)]">{item.name}</h2>
                <StatusBadge status={item.integration?.status ?? "draft"} />
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{item.description}</p>
              <p className={`mt-3 rounded-2xl px-3 py-2 text-xs font-semibold ${
                isVisibleToUsers
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                  : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
              }`}>
                {isVisibleToUsers
                  ? "Visible on sign-in and sign-up pages"
                  : "Hidden from users"}
              </p>
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                {item.integration
                  ? `${item.integration.credentials.length} credential(s) saved · ${scopeLabel(item.integration)}`
                  : "Not configured yet"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant={item.integration ? "secondary" : "primary"}>
                <Link href={item.integration ? `/admin/apis/${item.integration.id}` : `/admin/apis/new?provider=${item.provider}`}>
                  {item.integration ? "Manage configuration" : `Configure ${item.name}`}
                </Link>
              </Button>
              {item.integration ? (
                <form action={toggleOAuthSignInAction}>
                  <input type="hidden" name="integrationId" value={item.integration.id} />
                  <input type="hidden" name="enabled" value={isVisibleToUsers ? "false" : "true"} />
                  <Button type="submit" variant={isVisibleToUsers ? "warning" : "success"}>
                    {isVisibleToUsers ? "Disable sign-in" : "Enable sign-in"}
                  </Button>
                </form>
              ) : null}
              <form action={importOAuthFromEnvAction}>
                <input type="hidden" name="provider" value={item.provider} />
                <Button type="submit" variant="outline">Import from local env</Button>
              </form>
            </div>
          </Card>
          );
        })}
      </section>

      <AdminDataTable
        data={integrations}
        emptyMessage="No APIs configured yet. Add Google Maps, OAuth, SMTP, S3, Stripe, PayPal, YouTube, KYC, or a custom API from the API templates."
        columns={[
          {
            key: "api",
            header: "API",
            render: (item) => (
              <div>
                <Link href={`/admin/apis/${item.id}`} className="font-semibold text-[var(--color-primary)]">{item.displayName}</Link>
                <p className="text-xs text-[var(--color-muted)]">{providerLabel(item.provider)}</p>
              </div>
            ),
          },
          { key: "category", header: "Category", render: (item) => categoryLabel(item.category) },
          { key: "status", header: "Status", render: (item) => <StatusBadge status={apiConfigurationStatus(item)} /> },
          { key: "enabled", header: "Enabled", render: (item) => item.status === IntegrationStatus.active ? "Enabled" : "Disabled" },
          { key: "scope", header: "Scope", render: (item) => scopeLabel(item) },
          { key: "credentials", header: "Configured", render: (item) => configurationSummary(item) },
          { key: "test", header: "Last test", render: (item) => item.lastTestStatus === "not_tested" ? "Not tested" : `${item.lastTestStatus} · ${item.lastTestedAt ? item.lastTestedAt.toLocaleDateString() : "pending"}` },
          { key: "manage", header: "Manage", render: (item) => <Button asChild variant="secondary"><Link href={`/admin/apis/${item.id}`}>Manage</Link></Button> },
        ]}
      />
    </AdminShell>
  );
}

function missingRequiredFields(integration: Awaited<ReturnType<typeof listPlatformIntegrations>>[number]) {
  const savedCredentials = new Set(integration.credentials.map((credential) => credential.keyName));
  const savedSettings = new Set(integration.settings.map((setting) => setting.settingKey));

  return requiredProviderFields(integration.provider).filter((field) => {
    if (field.kind === "credential") return !savedCredentials.has(field.key);
    return !savedSettings.has(field.key);
  });
}

function apiConfigurationStatus(integration: Awaited<ReturnType<typeof listPlatformIntegrations>>[number]) {
  if (integration.status === IntegrationStatus.disabled) return "Disabled";
  if (integration.status === IntegrationStatus.error) return "Error";

  const missing = missingRequiredFields(integration);
  if (missing.length === requiredProviderFields(integration.provider).length) return "Not configured";
  if (missing.length) return "Missing required fields";
  if (integration.status === IntegrationStatus.active) return "Active";
  return "Ready to test";
}

function configurationSummary(integration: Awaited<ReturnType<typeof listPlatformIntegrations>>[number]) {
  const missing = missingRequiredFields(integration);
  if (!missing.length) return "Configured";
  return `Missing: ${missing.map((field) => field.label).join(", ")}`;
}

function isSocialSignInVisible(integration: Awaited<ReturnType<typeof listPlatformIntegrations>>[number]) {
  if (integration.status !== IntegrationStatus.active) return false;

  const loginButtonSetting = integration.settings.find((setting) => setting.settingKey === "loginButtonVisible");
  if (!loginButtonSetting) return true;

  return loginButtonSetting.settingValueJson === true || loginButtonSetting.settingValueJson === "true";
}
