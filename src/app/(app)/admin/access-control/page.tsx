import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listRoleAccessMatrix } from "@/server/rbac/role-service";
import { PERMISSION_DEFINITIONS } from "@/server/rbac/permission-catalog";

export const dynamic = "force-dynamic";

export default async function AdminAccessControlPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "auditor"]);
  const matrix = await listRoleAccessMatrix();
  const sensitive = PERMISSION_DEFINITIONS.filter((permission) => permission.sensitive);

  return (
    <AdminShell
      session={session}
      title="Access control"
      description="Review RBAC coverage for sensitive platform modules and user-specific overrides."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Permissions</p>
          <p className="mt-2 text-4xl font-bold text-[var(--color-ink)]">{matrix.permissions.length}</p>
          <Link href="/admin/permissions" className="mt-3 block text-sm font-medium text-[var(--color-primary)] hover:underline">
            View catalog →
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Platform roles</p>
          <p className="mt-2 text-4xl font-bold text-[var(--color-ink)]">{matrix.platformRoles.length}</p>
          <Link href="/admin/roles" className="mt-3 block text-sm font-medium text-[var(--color-primary)] hover:underline">
            View roles →
          </Link>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">User overrides</p>
          <p className="mt-2 text-4xl font-bold text-[var(--color-ink)]">{matrix.overrides.length}</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Sensitive modules</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sensitive.map((permission) => (
            <div key={permission.key} className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{permission.name}</p>
                  <p className="font-mono text-xs text-[var(--color-muted)]">{permission.key}</p>
                </div>
                <Badge tone="warning">{permission.module}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Active overrides</h2>
        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {matrix.overrides.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No user-specific permission overrides.</p>
          ) : (
            matrix.overrides.map((override) => (
              <div key={override.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{override.user.fullName}</p>
                  <p className="text-xs text-[var(--color-muted)]">{override.user.email} · {override.permission.key}</p>
                </div>
                <Badge tone={override.effect === "allow" ? "success" : "danger"}>{override.effect}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </AdminShell>
  );
}
