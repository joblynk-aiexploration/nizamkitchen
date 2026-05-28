import Link from "next/link";
import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPermissionsForAdmin } from "@/server/rbac/permission-service";

export const dynamic = "force-dynamic";

export default async function AdminUserPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin"]);
  const { id } = await params;
  const [user, permissions] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        permissionOverrides: { include: { permission: true, createdBy: true } },
      },
    }),
    listPermissionsForAdmin(),
  ]);

  if (!user) {
    return (
      <AdminShell session={session} title="User permissions" description="Manage user permission overrides.">
        <Card>
          <p className="text-sm text-[var(--color-muted)]">User not found.</p>
        </Card>
      </AdminShell>
    );
  }

  const overridesByKey = new Map(user.permissionOverrides.map((override) => [override.permission.key, override]));

  return (
    <AdminShell
      session={session}
      title={`${user.fullName} permissions`}
      description="User-specific overrides should be rare and never used to lock out the platform owner."
      actions={
        <Link href={`/admin/users/${user.id}`} className="text-sm font-medium text-[var(--color-primary)] hover:underline">
          Back to user
        </Link>
      }
    >
      <Card>
        <div className="grid gap-3 lg:grid-cols-2">
          {permissions.map((permission) => {
            const override = overridesByKey.get(permission.key);
            return (
              <div key={permission.key} className="rounded-2xl border border-[var(--color-border)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--color-ink)]">{permission.name}</p>
                    <p className="font-mono text-xs text-[var(--color-muted)]">{permission.key}</p>
                  </div>
                  {override ? (
                    <Badge tone={override.effect === "allow" ? "success" : "danger"}>{override.effect}</Badge>
                  ) : (
                    <Badge tone="neutral">Role default</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AdminShell>
  );
}
