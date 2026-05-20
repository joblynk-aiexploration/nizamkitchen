import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { listIntegrationTemplates, listPlatformIntegrations, platformConfigurationOperationalStatus } from "@/server/config/platform-config-service";

export const dynamic = "force-dynamic";

export default async function AdminConfigurationPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"]);
  const [integrations, templates] = await Promise.all([listPlatformIntegrations(session), Promise.resolve(listIntegrationTemplates())]);
  const operational = platformConfigurationOperationalStatus();
  const activeCount = integrations.filter((integration) => integration.status === "active").length;
  const secretCount = integrations.reduce((total, integration) => total + integration.credentials.filter((credential) => !credential.isPublicClientValue).length, 0);
  const publicCount = integrations.reduce((total, integration) => total + integration.credentials.filter((credential) => credential.isPublicClientValue).length, 0);

  return (
    <AdminShell
      session={session}
      title="Platform configuration vault"
      description="Centralize global and country-scoped integration credentials, callback URLs, provider settings, and safe test logs."
    >
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Configured integrations</p><p className="mt-3 text-2xl font-semibold">{integrations.length}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active integrations</p><p className="mt-3 text-2xl font-semibold">{activeCount}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Masked secrets</p><p className="mt-3 text-2xl font-semibold">{secretCount}</p></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Public client values</p><p className="mt-3 text-2xl font-semibold">{publicCount}</p></Card>
      </section>

      <Card className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Encryption readiness</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Server-side integration secrets are encrypted with <code>ENCRYPTION_KEY</code>. Full values are never shown after save.</p>
        </div>
        <Badge tone={operational.encryptionConfigured ? "success" : "warning"}>
          {operational.encryptionConfigured ? "Encryption ready" : "ENCRYPTION_KEY missing"}
        </Badge>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Integration coverage</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {templates.length} supported provider templates are available, including maps, auth, analytics, payments, storage, email, and verification services.
          </p>
        </Card>
        <Card>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Safe operations</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Public browser values must be explicitly marked safe. Server-only secrets stay encrypted and never appear in public config views or client payloads.
          </p>
        </Card>
      </section>

      <Card className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Social auth providers</h2>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Google and Facebook login now use this vault too, including callback URLs, allowed domains, auto-create behavior, and login button visibility.
          </p>
        </div>
        <Link
          href="/admin/configuration/auth"
          className="inline-flex rounded-2xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
        >
          Open auth providers
        </Link>
      </Card>
    </AdminShell>
  );
}
