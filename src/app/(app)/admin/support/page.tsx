import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const session = await requirePlatformRole([
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);
  const [recentUsers, recentOrganizations, deniedLogs] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.organization.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.auditLog.findMany({
      where: { action: "access.denied" },
      include: { actorUser: true, organization: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return (
    <AdminShell
      session={session}
      title="Support operations"
      description="Review support-facing operational data, recent accounts, account statuses, and access-denied investigations."
    >
      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Support notes</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">Placeholder only. Structured support notes can plug into this view later.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Impersonation</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">Placeholder only. Real impersonation is intentionally not implemented in this phase.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Access denied</h2>
          <div className="mt-4 flex items-center gap-2">
            <Badge tone="warning">{deniedLogs.length}</Badge>
            <span className="text-sm text-[var(--color-muted)]">Recent denied actions</span>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AdminDataTable
          data={recentUsers}
          emptyMessage="No recent users found."
          columns={[
            {
              key: "user",
              header: "Recent users",
              render: (user) => (
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{user.fullName}</p>
                  <p className="text-[var(--color-muted)]">{user.email}</p>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (user) => <StatusBadge value={user.status} />,
            },
          ]}
        />
        <AdminDataTable
          data={recentOrganizations}
          emptyMessage="No recent organizations found."
          columns={[
            {
              key: "organization",
              header: "Recent organizations",
              render: (organization) => (
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{organization.name}</p>
                  <p className="text-[var(--color-muted)]">{organization.organizationType}</p>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (organization) => <StatusBadge value={organization.status} />,
            },
          ]}
        />
      </section>
    </AdminShell>
  );
}
