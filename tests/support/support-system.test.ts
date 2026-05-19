import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCreateAdminNotification, mockCreateNotification, mockCreateAuditEvent } = vi.hoisted(() => ({
  mockPrisma: {
    supportTicket: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    supportTicketComment: {
      create: vi.fn(),
    },
  },
  mockCreateAdminNotification: vi.fn(),
  mockCreateNotification: vi.fn(),
  mockCreateAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/notifications/notification-service", () => ({
  createAdminNotification: mockCreateAdminNotification,
  createNotification: mockCreateNotification,
}));
vi.mock("@/server/audit", () => ({ createAuditEvent: mockCreateAuditEvent }));

import {
  addAdminSupportTicketComment,
  addUserSupportTicketComment,
  createSupportTicket,
  getUserSupportTicket,
  listAdminSupportTickets,
  updateAdminSupportTicket,
} from "../../src/server/support";

const householdSession = {
  user: { id: "user-1", platformRole: null },
  activeOrganization: { id: "org-1", countryCode: "US" },
};

const adminSession = {
  user: { id: "admin-1", platformRole: "platform_admin" as const },
  activeOrganization: null,
};

const baseTicket = {
  id: "ticket-1",
  organizationId: "org-1",
  createdById: "user-1",
  countryCode: "US",
  type: "bug",
  status: "open",
  priority: "normal",
  title: "Meal planner bug",
  description: "The meal planner page showed an error.",
  comments: [],
};

describe("beta support system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAuditEvent.mockResolvedValue({ id: "audit-1" });
    mockCreateAdminNotification.mockResolvedValue([]);
    mockCreateNotification.mockResolvedValue({ id: "notification-1" });
  });

  it("lets a user create an organization-scoped support ticket", async () => {
    mockPrisma.supportTicket.create.mockResolvedValue(baseTicket);

    await createSupportTicket(householdSession, {
      type: "bug",
      priority: "normal",
      title: "Meal planner bug",
      description: "The meal planner page showed an error.",
      pageUrl: "/meal-plans",
    });

    expect(mockPrisma.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          createdById: "user-1",
          countryCode: "US",
          type: "bug",
        }),
      }),
    );
    expect(mockCreateAdminNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "support_ticket.created" }));
  });

  it("scopes user ticket reads to the active organization or creator", async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue(baseTicket);

    await getUserSupportTicket(householdSession, "ticket-1");

    expect(mockPrisma.supportTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "ticket-1",
          OR: expect.arrayContaining([{ createdById: "user-1" }, { organizationId: "org-1" }]),
        }),
      }),
    );
  });

  it("throws when a user tries to read another organization ticket", async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue(null);

    await expect(getUserSupportTicket(householdSession, "other-ticket")).rejects.toThrow("Support ticket not found.");
  });

  it("lets admins view all tickets", async () => {
    mockPrisma.supportTicket.findMany.mockResolvedValue([baseTicket]);

    await listAdminSupportTickets(adminSession);

    expect(mockPrisma.supportTicket.findMany).toHaveBeenCalled();
  });

  it("lets admins reply and notifies the ticket creator", async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(baseTicket);
    mockPrisma.supportTicketComment.create.mockResolvedValue({ id: "comment-1" });

    await addAdminSupportTicketComment(adminSession, "ticket-1", {
      body: "Thanks, we are reviewing this.",
      isInternal: false,
    });

    expect(mockPrisma.supportTicketComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ticketId: "ticket-1", authorId: "admin-1", isInternal: false }),
      }),
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", type: "support_ticket.admin_reply" }));
  });

  it("keeps internal admin notes hidden from user comments", async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(baseTicket);
    mockPrisma.supportTicketComment.create.mockResolvedValue({ id: "comment-1" });

    await addAdminSupportTicketComment(adminSession, "ticket-1", {
      body: "Internal triage note.",
      isInternal: true,
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockPrisma.supportTicketComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isInternal: true }) }),
    );
  });

  it("changes status and notifies the user", async () => {
    mockPrisma.supportTicket.findUnique.mockResolvedValue(baseTicket);
    mockPrisma.supportTicket.update.mockResolvedValue({ ...baseTicket, status: "resolved" });

    await updateAdminSupportTicket(adminSession, "ticket-1", { status: "resolved" });

    expect(mockPrisma.supportTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "resolved" }),
      }),
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({ type: "support_ticket.status_changed" }));
  });

  it("does not allow users to create internal comments", async () => {
    mockPrisma.supportTicket.findFirst.mockResolvedValue(baseTicket);

    await expect(addUserSupportTicketComment(householdSession, "ticket-1", {
      body: "Please help.",
      isInternal: true,
    })).rejects.toThrow("User comments cannot be internal.");
  });
});
