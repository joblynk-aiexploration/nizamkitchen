import { prisma } from "@/lib/prisma";
import { assertPlatformRole } from "@/lib/auth";
import type { getCurrentSession } from "@/lib/session";
import type { ContactLeadInput } from "@/lib/validation/contact";

type Session = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>;

export async function createContactLead(input: ContactLeadInput) {
  return prisma.contactLead.create({
    data: {
      name: input.name,
      email: input.email,
      organizationType: input.organizationType ?? null,
      countryCode: input.countryCode ?? null,
      message: input.message,
      status: "new",
    },
  });
}

export async function listContactLeads(session: Session, status?: string) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);

  return prisma.contactLead.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function updateLeadStatus(session: Session, id: string, status: string) {
  assertPlatformRole(session.user.platformRole, [
    "platform_owner",
    "platform_admin",
    "support_admin",
  ]);

  return prisma.contactLead.update({
    where: { id },
    data: { status },
  });
}
