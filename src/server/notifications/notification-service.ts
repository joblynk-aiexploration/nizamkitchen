import { NotificationPriority, NotificationStatus, PlatformRole, Prisma } from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationPreferenceSchema } from "@/lib/validation/notifications";
import { renderEmailTemplate, sendEmail, type EmailTemplateKey } from "./email-service";
import type { getCurrentSession } from "@/lib/session";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

type NotificationInput = {
  organizationId?: string | null;
  userId?: string | null;
  countryCode?: string | null;
  type: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  priority?: NotificationPriority;
  emailTemplateKey?: EmailTemplateKey;
  preferenceKey?: keyof Pick<
    Awaited<ReturnType<typeof getNotificationPreference>>,
    "homeChefUpdates" | "chefRequestMessages" | "groceryReminders" | "mealPlanReminders" | "adminAlerts" | "marketingEmails"
  >;
};

export async function getNotificationPreference(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function createNotification(input: NotificationInput) {
  try {
    const user = input.userId
      ? await prisma.user.findUnique({
          where: { id: input.userId },
          select: { id: true, email: true },
        })
      : null;
    const preference = user ? await getNotificationPreference(user.id) : null;

    const shouldCreateInApp = !preference || preference.inAppEnabled;
    const notification = shouldCreateInApp
      ? await prisma.notification.create({
          data: {
            organizationId: input.organizationId ?? null,
            userId: input.userId ?? null,
            countryCode: input.countryCode ?? null,
            type: input.type,
            title: input.title,
            body: input.body,
            actionUrl: input.actionUrl ?? null,
            priority: input.priority ?? "normal",
          },
        })
      : null;

    const preferenceAllowsEmail =
      Boolean(user && input.emailTemplateKey && preference?.emailEnabled) &&
      (!input.preferenceKey || preference?.[input.preferenceKey] === true);

    if (preferenceAllowsEmail && user) {
      const rendered = renderEmailTemplate(input.emailTemplateKey!, {
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ? absoluteActionUrl(input.actionUrl) : null,
      });
      await sendEmail({
        to: user.email,
        templateKey: input.emailTemplateKey!,
        subject: rendered.subject,
        body: rendered.body,
        organizationId: input.organizationId,
        userId: user.id,
        countryCode: input.countryCode,
        metadata: { notificationType: input.type },
      });
    }

    return notification;
  } catch (error) {
    console.error("[notifications] failed to create notification", {
      type: input.type,
      organizationId: input.organizationId,
      userId: input.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

export async function createAdminNotification(input: Omit<NotificationInput, "userId">) {
  try {
    const users = await prisma.user.findMany({
      where: {
        status: "active",
        platformRole: { in: ["platform_owner", "platform_admin", "support_admin"] },
      },
      select: { id: true },
    });

    return Promise.all(users.map((user) => createNotification({ ...input, userId: user.id, preferenceKey: "adminAlerts" })));
  } catch (error) {
    console.error("[notifications] failed to create admin notifications", {
      type: input.type,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

export async function getNotificationInbox(session: Session, limit = 50) {
  const organizationId = session.activeOrganization?.id;
  const platformRole = session.user.platformRole;
  const platformCountryCodes = session.countryAssignments.map((assignment) => assignment.countryCode);

  return prisma.notification.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        organizationId ? { organizationId, userId: null } : {},
        platformRole ? { organizationId: null, userId: null, countryCode: null } : {},
        platformRole === "country_manager" ? { countryCode: { in: platformCountryCodes }, userId: null } : {},
      ].filter((clause) => Object.keys(clause).length > 0) as Prisma.NotificationWhereInput[],
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export async function getUnreadNotificationCount(session: Session) {
  const inbox = await getNotificationInbox(session, 100);
  return inbox.filter((notification) => notification.status === "unread").length;
}

export async function markNotificationRead(session: Session, notificationId: string) {
  const notification = await findAccessibleNotification(session, notificationId);
  if (!notification) throw new Error("Notification not found.");

  return prisma.notification.update({
    where: { id: notification.id },
    data: { status: "read", readAt: new Date() },
  });
}

export async function markAllNotificationsRead(session: Session) {
  const inbox = await getNotificationInbox(session, 100);
  const unreadIds = inbox.filter((notification) => notification.status === "unread").map((notification) => notification.id);
  if (unreadIds.length === 0) return { count: 0 };

  return prisma.notification.updateMany({
    where: { id: { in: unreadIds } },
    data: { status: "read", readAt: new Date() },
  });
}

export async function updateNotificationPreference(session: Session, input: unknown) {
  const parsed = notificationPreferenceSchema.parse(input);
  return prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: parsed,
    create: { userId: session.user.id, ...parsed },
  });
}

export function canSeeAdminNotifications(platformRole: PlatformRole | null | undefined) {
  try {
    assertPlatformRole(platformRole, ["platform_owner", "platform_admin", "support_admin", "auditor", "country_manager"]);
    return true;
  } catch {
    return false;
  }
}

async function findAccessibleNotification(session: Session, notificationId: string) {
  const inbox = await getNotificationInbox(session, 200);
  return inbox.find((notification) => notification.id === notificationId) ?? null;
}

function absoluteActionUrl(actionUrl: string) {
  if (actionUrl.startsWith("http://") || actionUrl.startsWith("https://")) return actionUrl;
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return new URL(actionUrl, base).toString();
}

export { NotificationStatus };
