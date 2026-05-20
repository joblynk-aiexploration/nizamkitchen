import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePlatformRole } from "@/lib/auth/session";
import { getSystemAlert } from "@/server/observability/system-alerts";

export const dynamic = "force-dynamic";

export default async function AdminSystemAlertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const { id } = await params;
  const alert = await getSystemAlert(session, id);
  const canManage = session.user.platformRole === "platform_owner" || session.user.platformRole === "platform_admin" || session.user.platformRole === "support_admin";

  return (
    <AdminShell
      session={session}
      title={alert.title}
      description="System alert detail with safe metadata and resolution controls."
      actions={<Button asChild variant="secondary"><Link href="/admin/system/alerts">Back to alerts</Link></Button>}
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="flex flex-wrap gap-2">
            <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>
            <Badge tone={alert.status === "open" ? "warning" : "success"}>{alert.status}</Badge>
            <Badge tone="neutral">{alert.type}</Badge>
          </div>
          <p className="mt-5 text-sm leading-6 text-[var(--color-muted)]">{alert.message}</p>
          <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <Detail label="Created" value={alert.createdAt.toLocaleString()} />
            <Detail label="Updated" value={alert.updatedAt.toLocaleString()} />
            <Detail label="Resolved at" value={alert.resolvedAt?.toLocaleString() ?? "Not resolved"} />
            <Detail label="Resolved by" value={alert.resolvedBy ? `${alert.resolvedBy.fullName} (${alert.resolvedBy.email})` : "Not set"} />
          </dl>
        </Card>

        <Card>
          <h2 className="font-semibold text-[var(--color-ink)]">Admin actions</h2>
          {canManage ? (
            <div className="mt-4 grid gap-3">
              <form action={`/api/admin/system/alerts/${alert.id}/resolve`} method="post">
                <Button type="submit" className="w-full" disabled={alert.status === "resolved"}>Resolve alert</Button>
              </form>
              <form action={`/api/admin/system/alerts/${alert.id}/ignore`} method="post">
                <Button type="submit" variant="secondary" className="w-full" disabled={alert.status === "ignored"}>Ignore alert</Button>
              </form>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-muted)]">Your role can view alerts but cannot change their status.</p>
          )}
        </Card>
      </section>

      <Card>
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Safe metadata</h2>
        <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          {JSON.stringify(alert.metadataJson ?? {}, null, 2)}
        </pre>
      </Card>
    </AdminShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-[var(--color-ink)]">{label}</dt><dd className="break-words text-[var(--color-muted)]">{value}</dd></div>;
}

function severityTone(severity: string): "info" | "warning" | "danger" {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}
