import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getAdminSystemStatus } from "@/server/admin/system-status";

export const dynamic = "force-dynamic";

export default async function AdminSystemHealthPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const status = await getAdminSystemStatus(session);

  return (
    <AdminShell
      session={session}
      title="System health"
      description="Live operational health checks for the app, database, payments, storage, and optional integrations."
      actions={<Button asChild variant="secondary"><Link href="/api/health">Open JSON health</Link></Button>}
    >
      <section className="grid gap-4 md:grid-cols-4">
        <HealthCard label="Database" ok={status.database.reachable} detail={status.database.migrationsReachable ? "Migrations reachable" : "Migration table unavailable"} />
        <HealthCard label="Payments" ok={status.integrations.paymentHealth.failedWebhooks === 0} detail={`${status.integrations.paymentHealth.failedWebhooks} failed webhooks`} />
        <HealthCard label="Storage" ok={status.integrations.storage.failingConfigurations === 0} detail={`${status.integrations.storage.activeConfigurations} active configs`} />
        <HealthCard label="Alerts" ok={status.alerts.critical === 0} detail={`${status.alerts.open} open alerts`} />
      </section>

      <Card>
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Health endpoints</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            ["/api/health", "App and database"],
            ["/api/health/db", "Database"],
            ["/api/health/storage", "Object storage"],
            ["/api/health/payments", "Payments"],
            ["/api/health/integrations", "Optional integrations"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-2xl border border-[var(--color-border)] px-4 py-3 text-sm font-semibold hover:bg-slate-50">
              {label}
              <span className="mt-1 block text-xs font-normal text-[var(--color-muted)]">{href}</span>
            </Link>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}

function HealthCard({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <Card>
      <p className="text-sm font-semibold text-[var(--color-muted)]">{label}</p>
      <p className="mt-3"><Badge tone={ok ? "success" : "danger"}>{ok ? "Healthy" : "Needs attention"}</Badge></p>
      <p className="mt-3 text-sm text-[var(--color-muted)]">{detail}</p>
    </Card>
  );
}
