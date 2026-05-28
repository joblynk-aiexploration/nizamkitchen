import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformRole } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRoleAccess } from "@/server/rbac/role-service";
import { PLATFORM_ROLE_ORDER } from "@/server/rbac/permission-catalog";

export const dynamic = "force-dynamic";

export default async function AdminRoleDetailPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "auditor"]);
  const { role } = await params;

  const scope = PLATFORM_ROLE_ORDER.includes(role as never) ? "platform" : "organization";
  const detail = await getRoleAccess(scope, role);

  if (detail.permissions.length === 0) {
    notFound();
  }

  return (
    <AdminShell
      session={session}
      title={role.replace(/_/g, " ")}
      description={`${scope} role permission coverage.`}
      actions={
        <Link href="/admin/roles" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
          Back to roles
        </Link>
      }
    >
      <Card>
        <h2 className="font-semibold text-[var(--color-ink)]">Permissions</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {detail.permissions.map((permission) => {
            const enabled = detail.enabledKeys.has(permission.key);
            return (
              <div key={permission.key} className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">{permission.name}</p>
                    <p className="font-mono text-xs text-[var(--color-muted)]">{permission.key}</p>
                  </div>
                  <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Allowed" : "Not granted"}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AdminShell>
  );
}
