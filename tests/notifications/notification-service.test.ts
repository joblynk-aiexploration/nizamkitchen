import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    notificationPreference: {
      upsert: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    emailLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  createAdminNotification,
  createNotification,
  getNotificationInbox,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreference,
} from "../../src/server/notifications/notification-service";
import { sendEmail } from "../../src/server/notifications/email-service";

const householdSession = {
  user: { id: "user-1", email: "household@example.test", status: "active" as const, platformRole: null },
  activeOrganization: { id: "org-1", countryCode: "US" },
  countryAssignments: [],
};

describe("notification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.notificationPreference.upsert.mockResolvedValue({
      userId: "user-1",
      emailEnabled: true,
      inAppEnabled: true,
      homeChefUpdates: true,
      chefRequestMessages: true,
      groceryReminders: true,
      mealPlanReminders: true,
      adminAlerts: true,
      marketingEmails: false,
    });
  });

  it("creates in-app notifications", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "household@example.test" });
    mockPrisma.notification.create.mockResolvedValue({ id: "notification-1", status: "unread" });
    mockPrisma.emailLog.create.mockResolvedValue({ id: "email-1" });

    await createNotification({
      organizationId: "org-1",
      userId: "user-1",
      type: "home_chef_request_submitted",
      title: "Submitted",
      body: "Request submitted.",
      preferenceKey: "homeChefUpdates",
      emailTemplateKey: "home_chef_request_submitted",
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: "org-1", userId: "user-1" }),
      }),
    );
    expect(mockPrisma.emailLog.create).toHaveBeenCalled();
  });

  it("does not crash when SMTP is effectively placeholder-only", async () => {
    await expect(sendEmail({
      to: "user@example.test",
      templateKey: "grocery_list_shared",
      subject: "Shared",
      body: "A grocery list was shared.",
    })).resolves.toEqual(expect.objectContaining({ sent: false }));
  });

  it("respects disabled in-app preferences", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "household@example.test" });
    mockPrisma.notificationPreference.upsert.mockResolvedValue({
      userId: "user-1",
      emailEnabled: false,
      inAppEnabled: false,
      homeChefUpdates: true,
      chefRequestMessages: true,
      groceryReminders: true,
      mealPlanReminders: true,
      adminAlerts: true,
      marketingEmails: false,
    });

    await createNotification({
      userId: "user-1",
      type: "home_chef_request_status_changed",
      title: "Changed",
      body: "Status changed.",
    });

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
  });

  it("scopes inbox queries to user and active organization", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);

    await getNotificationInbox(householdSession as never);

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { userId: "user-1" },
            { organizationId: "org-1", userId: null },
          ]),
        }),
      }),
    );
  });

  it("counts unread notifications from accessible inbox only", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      { id: "n1", status: "unread" },
      { id: "n2", status: "read" },
      { id: "n3", status: "unread" },
    ]);

    await expect(getUnreadNotificationCount(householdSession as never)).resolves.toBe(2);
  });

  it("marks one accessible notification as read", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ id: "n1", status: "unread" }]);
    mockPrisma.notification.update.mockResolvedValue({ id: "n1", status: "read" });

    await markNotificationRead(householdSession as never, "n1");

    expect(mockPrisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "n1" }, data: expect.objectContaining({ status: "read" }) }),
    );
  });

  it("marks all accessible notifications as read", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ id: "n1", status: "unread" }, { id: "n2", status: "read" }]);
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await markAllNotificationsRead(householdSession as never);

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["n1"] } } }),
    );
  });

  it("updates notification preferences", async () => {
    mockPrisma.notificationPreference.upsert.mockResolvedValue({ userId: "user-1", emailEnabled: false });

    await updateNotificationPreference(householdSession as never, {
      emailEnabled: false,
      inAppEnabled: true,
      homeChefUpdates: true,
      chefRequestMessages: true,
      groceryReminders: true,
      mealPlanReminders: true,
      adminAlerts: true,
      marketingEmails: false,
    });

    expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });

  it("creates admin notifications only for platform users", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    mockPrisma.user.findUnique.mockResolvedValue({ id: "admin-1", email: "admin@example.test" });
    mockPrisma.notification.create.mockResolvedValue({ id: "notification-1" });

    await createAdminNotification({
      type: "feature_flag_changed",
      title: "Flag changed",
      body: "A feature flag changed.",
    });

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ platformRole: { in: ["platform_owner", "platform_admin", "support_admin"] } }),
      }),
    );
  });
});
