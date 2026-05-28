import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listRoleAccessMatrix } from "@/server/rbac/role-service";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "auditor"]);
  const matrix = await listRoleAccessMatrix();

  return (
    <AdminShell
      session={session}
      title="Roles"
      description="Platform and organization role access overview. Platform owner retains full control and cannot be locked out."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {matrix.platformRoles.map((role) => (
          <Card key={role.role}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-[var(--color-ink)]">{role.role.replace(/_/g, " ")}</h2>
                <p className="text-sm text-[var(--color-muted)]">Platform role</p>
              </div>
              <Badge tone={role.role === "platform_owner" ? "success" : "neutral"}>
                {role.permissions.size} permissions
              </Badge>
            </div>
            <Link
              href={`/admin/roles/${role.role}`}
              className="mt-4 inline-flex text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              View role access →
            </Link>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Organization roles</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {matrix.organizationRoles.map((role) => (
            <div key={role.role} className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
              <p className="font-medium text-[var(--color-ink)]">{role.role.replace(/_/g, " ")}</p>
              <p className="text-xs text-[var(--color-muted)]">{role.permissions.size} permissions</p>
            </div>
          ))}
        </div>
      </Card>
    </AdminShell>
  );
}
