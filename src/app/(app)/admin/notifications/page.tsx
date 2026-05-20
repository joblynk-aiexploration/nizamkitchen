import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const notifications = await prisma.notification.findMany({
    include: {
      user: { select: { email: true, fullName: true } },
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AdminShell session={session} title="Notifications" description="Recent in-app notifications and delivery-ready events.">
      <AdminDataTable
        data={notifications}
        emptyMessage="No notifications found."
        columns={[
          {
            key: "title",
            header: "Notification",
            render: (notification) => (
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{notification.title}</p>
                <p className="text-xs text-[var(--color-muted)]">{notification.type}</p>
              </div>
            ),
          },
          {
            key: "recipient",
            header: "Recipient",
            render: (notification) => (
              <span className="text-sm">
                {notification.user?.email ?? notification.organization?.name ?? notification.countryCode ?? "Platform"}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (notification) => <Badge tone={notification.status === "unread" ? "info" : "neutral"}>{notification.status}</Badge>,
          },
          {
            key: "priority",
            header: "Priority",
            render: (notification) => <Badge tone={notification.priority === "urgent" || notification.priority === "high" ? "warning" : "neutral"}>{notification.priority}</Badge>,
          },
          {
            key: "created",
            header: "Created",
            render: (notification) => <span className="text-sm text-[var(--color-muted)]">{formatDate(notification.createdAt)}</span>,
          },
        ]}
      />
    </AdminShell>
  );
}
