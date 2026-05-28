import { requirePlatformRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { getPaginationInput, getPaginationMeta } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePlatformRole(["platform_owner", "platform_admin", "support_admin", "auditor"]);
  const params = await searchParams;
  const paginationInput = getPaginationInput({ page: params.page });
  const [totalNotifications, notifications] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.findMany({
      include: {
        user: { select: { email: true, fullName: true } },
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: paginationInput.skip,
      take: paginationInput.take,
    }),
  ]);

  return (
    <AdminShell session={session} title="Notifications" description="Recent in-app notifications and delivery-ready events.">
      <AdminDataTable
        data={notifications}
        emptyMessage="No notifications found."
        pagination={getPaginationMeta(totalNotifications, paginationInput)}
        paginationBasePath="/admin/notifications"
        paginationSearchParams={params}
        paginationItemLabel="notifications"
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
