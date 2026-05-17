import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  MembershipStatus,
  type OrganizationRole,
  type PlatformRole,
} from "@prisma/client";
import {
  AccessDeniedError,
  assertMembershipAccess,
  assertOrganizationRole,
  assertPlatformRole,
  assertUserCanAuthenticate,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getClientIpFromHeaders } from "@/lib/security";
import { generateOpaqueToken, hashToken } from "@/lib/security.server";
import { auditAccessDenied, createAuditEvent } from "@/server/audit";

export const SESSION_COOKIE_NAME = env.SESSION_COOKIE_NAME;

export async function getRequestMetadata() {
  const headerStore = await headers();

  return {
    ipAddress: getClientIpFromHeaders(headerStore),
    userAgent: headerStore.get("user-agent"),
  };
}

export async function createSession(userId: string, activeOrganizationId?: string | null) {
  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + env.SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );
  const metadata = await getRequestMetadata();

  await prisma.session.create({
    data: {
      tokenHash,
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
    priority: "high",
  });

  return { token, expiresAt };
}

export async function destroySession(rawToken?: string | null) {
  const cookieStore = await cookies();
  const token = rawToken ?? cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
    priority: "high",
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: true,
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    await destroySession(token);
    return null;
  }

  try {
    assertUserCanAuthenticate(session.user);
  } catch {
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

  const countryAssignments = await prisma.countryAssignment.findMany({
    where: { userId: session.userId },
    orderBy: { countryCode: "asc" },
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
    sessionToken: token,
    memberships,
    countryAssignments,
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

  try {
    assertMembershipAccess(session);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "route",
        details: { reason: error.code },
      });
    }
    redirect("/login?message=Access denied.");
  }

  return session as typeof session & {
    activeMembership: NonNullable<typeof session.activeMembership>;
    activeOrganization: NonNullable<typeof session.activeOrganization>;
  };
}

export async function requirePlatformRole(roles: PlatformRole[]) {
  const session = await requireUser();

  try {
    assertPlatformRole(session.user.platformRole, roles);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "route",
        details: { reason: error.code, rolesRequested: roles },
      });
    }
    redirect("/dashboard?message=Access denied.");
  }

  return session;
}

export async function requireOrganizationRole(roles: OrganizationRole[]) {
  const session = await requireMembership();

  try {
    assertOrganizationRole(session, roles);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      await auditAccessDenied({
        session,
        targetType: "route",
        details: { reason: error.code, rolesRequested: roles },
      });
    }
    redirect("/dashboard?message=Access denied.");
  }

  return session;
}

export async function refreshSessionActivity(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });
}

export async function createLoginAuditEvent(params: {
  actorUserId: string;
  organizationId?: string | null;
  countryCode?: string | null;
}) {
  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: params.organizationId ?? null,
    countryCode: params.countryCode ?? null,
    action: "user.login",
    targetType: "session",
    targetId: params.actorUserId,
    ...(await getRequestMetadata()),
  });
}
