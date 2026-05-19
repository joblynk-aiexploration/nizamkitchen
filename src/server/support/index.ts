import type { PlatformRole, Prisma, SupportTicketPriority, SupportTicketStatus, SupportTicketType } from "@prisma/client";
import { assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  supportTicketAdminUpdateSchema,
  supportTicketCommentSchema,
  supportTicketCreateSchema,
} from "@/lib/validation/support";
import { createAuditEvent } from "@/server/audit";
import { createAdminNotification, createNotification } from "@/server/notifications/notification-service";

const SUPPORT_ADMIN_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "support_admin"];

export type SupportSession = {
  user: {
    id: string;
    platformRole: PlatformRole | null;
  };
  activeOrganization?: {
    id: string;
    countryCode: string;
  } | null;
};

const ticketInclude = {
  createdBy: { select: { id: true, fullName: true, email: true } },
  assignedTo: { select: { id: true, fullName: true, email: true } },
  organization: { select: { id: true, name: true, organizationType: true } },
  comments: {
    include: { author: { select: { id: true, fullName: true, email: true, platformRole: true } } },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.SupportTicketInclude;

export async function createSupportTicket(session: SupportSession, input: unknown) {
  const parsed = supportTicketCreateSchema.parse(input);
  const ticket = await prisma.supportTicket.create({
    data: {
      organizationId: session.activeOrganization?.id ?? null,
      createdById: session.user.id,
      countryCode: session.activeOrganization?.countryCode ?? null,
      type: parsed.type,
      priority: parsed.priority,
      title: parsed.title,
      description: parsed.description,
      pageUrl: parsed.pageUrl ?? null,
      browserInfo: parsed.browserInfo ?? null,
    },
    include: ticketInclude,
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: ticket.organizationId,
    countryCode: ticket.countryCode,
    action: "support_ticket.created",
    targetType: "support_ticket",
    targetId: ticket.id,
    details: { type: ticket.type, priority: ticket.priority },
  });

  await createAdminNotification({
    organizationId: ticket.organizationId,
    countryCode: ticket.countryCode,
    type: "support_ticket.created",
    title: "New support ticket",
    body: `${ticket.title} was submitted by a beta user.`,
    actionUrl: `/admin/support/${ticket.id}`,
    priority: ticket.priority === "urgent" ? "urgent" : "normal",
    emailTemplateKey: "support_ticket_created",
  });

  return ticket;
}

export async function listUserSupportTickets(session: SupportSession) {
  return prisma.supportTicket.findMany({
    where: userTicketWhere(session),
    include: ticketInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserSupportTicket(session: SupportSession, ticketId: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, ...userTicketWhere(session) },
    include: ticketInclude,
  });
  if (!ticket) throw new Error("Support ticket not found.");
  return ticket;
}

export async function addUserSupportTicketComment(session: SupportSession, ticketId: string, input: unknown) {
  const ticket = await getUserSupportTicket(session, ticketId);
  const parsed = supportTicketCommentSchema.parse(input);
  if (parsed.isInternal) throw new Error("User comments cannot be internal.");

  const comment = await prisma.supportTicketComment.create({
    data: {
      ticketId: ticket.id,
      authorId: session.user.id,
      body: parsed.body,
      isInternal: false,
    },
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: ticket.organizationId,
    countryCode: ticket.countryCode,
    action: "support_ticket.comment_created",
    targetType: "support_ticket",
    targetId: ticket.id,
  });

  await createAdminNotification({
    organizationId: ticket.organizationId,
    countryCode: ticket.countryCode,
    type: "support_ticket.user_reply",
    title: "Beta user replied to support ticket",
    body: ticket.title,
    actionUrl: `/admin/support/${ticket.id}`,
    priority: ticket.priority === "urgent" ? "urgent" : "normal",
  });

  return comment;
}

export async function listAdminSupportTickets(session: SupportSession, filters?: {
  type?: SupportTicketType;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
}) {
  assertPlatformRole(session.user.platformRole, SUPPORT_ADMIN_ROLES);
  return prisma.supportTicket.findMany({
    where: {
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.priority ? { priority: filters.priority } : {}),
    },
    include: ticketInclude,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function getAdminSupportTicket(session: SupportSession, ticketId: string) {
  assertPlatformRole(session.user.platformRole, SUPPORT_ADMIN_ROLES);
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, include: ticketInclude });
  if (!ticket) throw new Error("Support ticket not found.");
  return ticket;
}

export async function updateAdminSupportTicket(session: SupportSession, ticketId: string, input: unknown) {
  assertPlatformRole(session.user.platformRole, SUPPORT_ADMIN_ROLES);
  const existing = await getAdminSupportTicket(session, ticketId);
  const parsed = supportTicketAdminUpdateSchema.parse(input);
  const nextStatus = parsed.status ?? existing.status;

  const ticket = await prisma.supportTicket.update({
    where: { id: existing.id },
    data: {
      ...(parsed.status ? { status: parsed.status, closedAt: ["resolved", "closed"].includes(parsed.status) ? new Date() : null } : {}),
      ...(parsed.priority ? { priority: parsed.priority } : {}),
      ...(parsed.assignedToId !== undefined ? { assignedToId: parsed.assignedToId } : {}),
      ...(parsed.adminNotes !== undefined ? { adminNotes: parsed.adminNotes } : {}),
    },
    include: ticketInclude,
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: ticket.organizationId,
    countryCode: ticket.countryCode,
    action: "support_ticket.updated",
    targetType: "support_ticket",
    targetId: ticket.id,
    details: {
      oldStatus: existing.status,
      newStatus: ticket.status,
      priority: ticket.priority,
      assignedToId: ticket.assignedToId,
    },
  });

  if (nextStatus !== existing.status && ticket.createdById) {
    await createNotification({
      organizationId: ticket.organizationId,
      userId: ticket.createdById,
      countryCode: ticket.countryCode,
      type: "support_ticket.status_changed",
      title: "Support ticket status changed",
      body: `"${ticket.title}" is now ${ticket.status}.`,
      actionUrl: `/support/tickets/${ticket.id}`,
      priority: ticket.priority === "urgent" ? "urgent" : "normal",
      emailTemplateKey: "support_ticket_status_changed",
      preferenceKey: "adminAlerts",
    });
  }

  return ticket;
}

export async function addAdminSupportTicketComment(session: SupportSession, ticketId: string, input: unknown) {
  assertPlatformRole(session.user.platformRole, SUPPORT_ADMIN_ROLES);
  const ticket = await getAdminSupportTicket(session, ticketId);
  const parsed = supportTicketCommentSchema.parse(input);

  const comment = await prisma.supportTicketComment.create({
    data: {
      ticketId: ticket.id,
      authorId: session.user.id,
      body: parsed.body,
      isInternal: parsed.isInternal,
    },
  });

  await createAuditEvent({
    actorUserId: session.user.id,
    organizationId: ticket.organizationId,
    countryCode: ticket.countryCode,
    action: "support_ticket.comment_created",
    targetType: "support_ticket",
    targetId: ticket.id,
    details: { isInternal: parsed.isInternal },
  });

  if (!parsed.isInternal && ticket.createdById) {
    await createNotification({
      organizationId: ticket.organizationId,
      userId: ticket.createdById,
      countryCode: ticket.countryCode,
      type: "support_ticket.admin_reply",
      title: "Support replied to your ticket",
      body: ticket.title,
      actionUrl: `/support/tickets/${ticket.id}`,
      priority: ticket.priority === "urgent" ? "urgent" : "normal",
      emailTemplateKey: "support_ticket_reply",
      preferenceKey: "adminAlerts",
    });
  }

  return comment;
}

function userTicketWhere(session: SupportSession): Prisma.SupportTicketWhereInput {
  return {
    OR: [
      { createdById: session.user.id },
      ...(session.activeOrganization?.id ? [{ organizationId: session.activeOrganization.id }] : []),
    ],
  };
}
