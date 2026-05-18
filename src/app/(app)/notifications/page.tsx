import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { getNotificationInbox } from "@/server/notifications/notification-service";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

export const dynamic = "force-dynamic";

const priorityTone = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
} as const;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const session = await requireUser();
  const query = await searchParams;
  const notifications = await getNotificationInbox(session, 100);
  const unreadCount = notifications.filter((notification) => notification.status === "unread").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="Inbox"
        description="Review important updates across your workspace, admin responsibilities, chef requests, and grocery workflows."
        actions={
          unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="secondary">Mark all read</Button>
            </form>
          ) : null
        }
      />

      {query.message && <Card className="border-blue-200 bg-blue-50 text-sm text-blue-800">{query.message}</Card>}

      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet" description="Important updates will appear here as product workflows move." />
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card key={notification.id} className={notification.status === "unread" ? "border-emerald-200 bg-emerald-50/50" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[var(--color-ink)]">{notification.title}</h2>
                    <Badge tone={notification.status === "unread" ? "success" : "neutral"}>{notification.status}</Badge>
                    <Badge tone={priorityTone[notification.priority]}>{notification.priority}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{notification.body}</p>
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    {notification.type.replace(/_/g, " ")} · {notification.createdAt.toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {notification.actionUrl && (
                    <Button asChild variant="secondary">
                      <Link href={notification.actionUrl}>Open</Link>
                    </Button>
                  )}
                  {notification.status === "unread" && (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <Button type="submit" variant="ghost">Mark read</Button>
                    </form>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
