import Link from "next/link";
import { IntegrationStatus } from "@prisma/client";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import {
  listIntegrationTemplates,
  listPlatformIntegrations,
  platformConfigurationOperationalStatus,
} from "@/server/config/platform-config-service";
import { ApiManagementTabs, categoryLabel, providerLabel, scopeLabel, StatusBadge } from "./_components";

export const dynamic = "force-dynamic";

export default async function ApiManagementPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const session = await requirePlatformRole(["platform_owner"]);
  const [params, integrations] = await Promise.all([searchParams, listPlatformIntegrations(session)]);
  const templates = listIntegrationTemplates();
  const operationalStatus = platformConfigurationOperationalStatus();
  const activeCount = integrations.filter((integration) => integration.status === IntegrationStatus.active).length;
  const secretCount = integrations.reduce((total, integration) => total + integration.credentials.filter((credential) => !credential.isPublicClientValue).length, 0);
  const publicKeyCount = integrations.reduce((total, integration) => total + integration.credentials.filter((credential) => credential.isPublicClientValue).length, 0);

  return (
    <AdminShell
      session={session}
      title="API Management"
      description="Platform Owner control for application APIs, encrypted credentials, public keys, webhooks, country scopes, and safe integration tests."
      actions={<Button asChild><Link href="/admin/apis/new">Add API</Link></Button>}
    >
      <ApiManagementTabs active="/admin/apis" />
      {params.message ? <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{params.message}</Card> : null}

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
          { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
          { key: "scope", header: "Scope", render: (item) => scopeLabel(item) },
          { key: "credentials", header: "Credentials", render: (item) => `${item.credentials.length} saved` },
          { key: "test", header: "Last test", render: (item) => item.lastTestStatus === "not_tested" ? "Not tested" : `${item.lastTestStatus} · ${item.lastTestedAt ? item.lastTestedAt.toLocaleDateString() : "pending"}` },
        ]}
      />
    </AdminShell>
  );
}
