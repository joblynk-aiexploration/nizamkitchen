import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  MembershipStatus,
  type OrganizationRole,
  type PlatformRole,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = env.SESSION_COOKIE_NAME;

export async function getRequestMetadata() {
  const headerStore = await headers();

  return {
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerStore.get("x-real-ip") ??
      null,
    userAgent: headerStore.get("user-agent"),
  };
}

export async function createSession(userId: string, activeOrganizationId?: string | null) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + env.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );
  const metadata = await getRequestMetadata();

  await prisma.session.create({
    data: {
      token,
      userId,
      activeOrganizationId: activeOrganizationId ?? null,
      expiresAt,
      ...metadata,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  return { token, expiresAt };
}

export async function destroySession(token?: string | null) {
  const cookieStore = await cookies();
  const sessionToken = token ?? cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await prisma.session.deleteMany({
      where: { token: sessionToken },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: true,
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    await destroySession(token);
    return null;
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: session.userId,
      status: MembershipStatus.active,
    },
    include: {
      organization: {
        include: {
          country: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const activeMembership =
    memberships.find((membership) => membership.organizationId === session.activeOrganizationId) ??
    memberships[0] ??
    null;

  if (activeMembership && session.activeOrganizationId !== activeMembership.organizationId) {
    await prisma.session.update({
      where: { id: session.id },
      data: { activeOrganizationId: activeMembership.organizationId },
    });
  }

  return {
    ...session,
    memberships,
    activeMembership,
    activeOrganization: activeMembership?.organization ?? null,
  };
}

export async function requireUser() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function requireMembership() {
  const session = await requireUser();

  if (!session.activeMembership || !session.activeOrganization) {
    redirect("/organizations?message=No active organization available.");
  }

  return session as typeof session & {
    activeMembership: NonNullable<typeof session.activeMembership>;
    activeOrganization: NonNullable<typeof session.activeOrganization>;
  };
}

export async function requirePlatformRole(roles: PlatformRole[]) {
  const session = await requireUser();

  if (!session.user.platformRole || !roles.includes(session.user.platformRole)) {
    await createAuditLog({
      actorUserId: session.user.id,
      organizationId: session.activeOrganization?.id,
      countryCode: session.activeOrganization?.countryCode,
      action: "access.denied",
      targetType: "route",
      details: { rolesRequested: roles },
      ...(await getRequestMetadata()),
    });
    redirect("/dashboard?message=Access denied.");
  }

  return session;
}

export async function requireOrganizationRole(roles: OrganizationRole[]) {
  const session = await requireMembership();

  if (!roles.includes(session.activeMembership.role)) {
    await createAuditLog({
      actorUserId: session.user.id,
      organizationId: session.activeOrganization.id,
      countryCode: session.activeOrganization.countryCode,
      action: "access.denied",
      targetType: "route",
      details: { rolesRequested: roles },
      ...(await getRequestMetadata()),
    });
    redirect("/dashboard?message=Access denied.");
  }

  return session;
}
