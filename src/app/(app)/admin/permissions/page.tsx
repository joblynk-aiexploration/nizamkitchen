import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { listPermissionsForAdmin } from "@/server/rbac/permission-service";
import { PERMISSION_DEFINITIONS } from "@/server/rbac/permission-catalog";

export const dynamic = "force-dynamic";

export default async function AdminPermissionsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "auditor"]);
  const permissions = await listPermissionsForAdmin();
  const sensitiveKeys = new Set(
    PERMISSION_DEFINITIONS.filter((permission) => permission.sensitive).map((permission) => permission.key),
  );

  return (
    <AdminShell
      session={session}
      title="Permissions"
      description="Canonical permission catalog grouped by platform module and action."
    >
      <AdminDataTable
        data={permissions}
        emptyMessage="No permissions are configured yet. Run the seed to initialize the RBAC catalog."
        columns={[
          {
            key: "key",
            header: "Permission",
            render: (permission) => (
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{permission.name}</p>
                <p className="font-mono text-xs text-[var(--color-muted)]">{permission.key}</p>
              </div>
            ),
          },
          {
            key: "module",
            header: "Module",
            render: (permission) => <span className="text-sm">{permission.module}</span>,
          },
          {
            key: "action",
            header: "Action",
            render: (permission) => <Badge tone="neutral">{permission.action}</Badge>,
          },
          {
            key: "sensitive",
            header: "Sensitivity",
            render: (permission) =>
              sensitiveKeys.has(permission.key) ? <Badge tone="warning">Sensitive</Badge> : <Badge tone="neutral">Standard</Badge>,
          },
          {
            key: "roles",
            header: "Role bindings",
            render: (permission) => (
              <span className="text-sm text-[var(--color-muted)]">
                {permission.roleBindings.length} roles, {permission._count.userOverrides} overrides
              </span>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
