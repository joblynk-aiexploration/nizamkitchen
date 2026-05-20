import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAdminSystemStatus } from "@/server/admin/system-status";

export const dynamic = "force-dynamic";

function statusTone(configured: boolean) {
  return configured ? "success" : "warning";
}

export default async function AdminSystemPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const status = await getAdminSystemStatus(session);

  const integrations = [
    ["MapTiler", status.integrations.mapTiler.configured, "Restaurant fallback map search"],
    ["YouTube", status.integrations.youtube.configured, "Recipe video discovery"],
    ["SMTP", status.integrations.smtp.configured, "Transactional email delivery"],
    ["Stripe", status.integrations.stripe.configured, "Hosted checkout and subscriptions"],
    ["PayPal", status.integrations.paypal.configured, "PayPal checkout"],
    ["S3 storage", status.integrations.storage.configured, "Uploaded files and documents"],
    ["KYC providers", status.integrations.kyc.configured, "Identity and background provider setup"],
    ["Error tracking", status.integrations.errorTracking.configured, "External error tracking placeholder"],
  ] as const;

  return (
    <AdminShell
      session={session}
      title="System status"
      description="Production operations snapshot for platform owners and admins. Values are safe summaries only; secrets are never displayed."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">App version</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{status.app.version}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{status.app.build}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Database</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={status.database.reachable ? "success" : "danger"}>
              {status.database.reachable ? "Reachable" : "Unreachable"}
            </Badge>
            <Badge tone={status.database.migrationsReachable ? "success" : "danger"}>
              {status.database.migrationsReachable ? "Migrations healthy" : "Migrations unavailable"}
            </Badge>
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Environment</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{status.app.environment}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Runtime label only, not secret config.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Open alerts</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{status.alerts.open}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{status.alerts.critical} critical, {status.alerts.warning} warning</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Failed webhooks</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{status.integrations.paymentHealth.failedWebhooks}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Stored provider events needing review.</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Storage failures</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{status.failures.storageFailures.length}</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Recent failed S3/storage checks.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Feature flags</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{status.counts.featureFlags}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Users</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{status.counts.users}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-[var(--color-muted)]">Organizations</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-ink)]">{status.counts.organizations}</p>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">Integration configuration</h2>
            <p className="text-sm text-[var(--color-muted)]">Shows whether optional providers are configured, never their values.</p>
          </div>
          <Badge tone="info">Secrets hidden</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {integrations.map(([name, configured, description]) => (
            <div key={name} className="rounded-2xl border border-[var(--color-border)] bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--color-ink)]">{name}</p>
                <Badge tone={statusTone(configured)}>{configured ? "Configured" : "Not configured"}</Badge>
              </div>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{description}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Latest audit activity</h2>
          <div className="mt-4 divide-y divide-[var(--color-border)]">
            {status.latestAuditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{log.action}</p>
                  <p className="text-sm text-[var(--color-muted)]">
                    {log.targetType ?? "platform"} {log.countryCode ? `- ${log.countryCode}` : ""}
                  </p>
                </div>
                <p className="text-xs text-[var(--color-muted)]">{log.createdAt.toISOString()}</p>
              </div>
            ))}
            {status.latestAuditLogs.length === 0 && (
              <p className="py-4 text-sm text-[var(--color-muted)]">No audit logs found yet.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Operations links</h2>
          <div className="mt-4 grid gap-3">
            <Link className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold hover:bg-slate-50" href="/admin/audit-logs">
              Open audit logs
            </Link>
            <Link className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold hover:bg-slate-50" href="/admin/feature-flags">
              Disable feature flags
            </Link>
            <Link className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold hover:bg-slate-50" href="/admin/system/health">
              Open health checks
            </Link>
            <Link className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold hover:bg-slate-50" href="/admin/system/alerts">
              Review system alerts
            </Link>
            <Link className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold hover:bg-slate-50" href="/admin/system/integrations">
              Integration status
            </Link>
            <a className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold hover:bg-slate-50" href="https://github.com/joblynk-aiexploration/nizamkitchen/blob/main/docs/backup-and-restore.md">
              Backup and restore docs
            </a>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
