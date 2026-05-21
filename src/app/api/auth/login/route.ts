import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { AccessDeniedError, assertUserCanAuthenticate } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getClientIpFromHeaders, rateLimitPolicies } from "@/lib/security";
import { createSession, getRequestMetadata } from "@/lib/session";
import { loginSchema } from "@/lib/validation/auth";
import { createAuditLog } from "@/lib/audit";
import { verifyRecaptcha } from "@/server/seo/seo-service";

export async function POST(request: Request) {
  const clientIp = getClientIpFromHeaders(request.headers);

  try {
    enforceRateLimit({
      key: `login:${clientIp}`,
      ...rateLimitPolicies.login,
    });
  } catch {
    return redirectAfterPost(new URL("/login?message=Too many requests.", request.url));
  }

  const formData = await request.formData();
  const recaptcha = await verifyRecaptcha({
    token: formData.get("recaptchaToken")?.toString(),
    page: "login",
    ip: clientIp,
  });
  if (!recaptcha.ok) {
    return redirectAfterPost(new URL(`/login?message=${encodeURIComponent(recaptcha.reason)}`, request.url));
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return redirectAfterPost(new URL("/login?message=Invalid credentials.", request.url));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: {
        memberships: {
          where: { status: "active" },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return redirectAfterPost(new URL("/login?message=Invalid credentials.", request.url));
    }

    try {
      assertUserCanAuthenticate(user);
    } catch (error) {
      await createAuditLog({
        actorUserId: user.id,
        action: "access.denied",
        targetType: "auth.login",
        targetId: user.id,
        details: {
          reason: error instanceof AccessDeniedError ? error.code : "UNKNOWN",
        },
        ...(await getRequestMetadata()),
      });
      return redirectAfterPost(new URL("/login?message=Invalid credentials.", request.url));
    }

    const activeMembership = user.memberships[0];
    await createSession(user.id, activeMembership?.organizationId);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await createAuditLog({
      actorUserId: user.id,
      organizationId: activeMembership?.organizationId,
      countryCode: null,
      action: "user.login",
      targetType: "session",
      targetId: user.id,
      ...(await getRequestMetadata()),
    });

    return redirectAfterPost(
      new URL(getPostLoginRedirectPath(user.platformRole, activeMembership?.organizationId), request.url),
    );
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return redirectAfterPost(
        new URL(
          "/login?message=Database unavailable. Start PostgreSQL to sign in.",
          request.url,
        ),
      );
    }

    throw error;
  }
}

function redirectAfterPost(url: URL) {
  return NextResponse.redirect(url, { status: 303 });
}

function isDatabaseUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001")
  );
}

function getPostLoginRedirectPath(
  platformRole: string | null,
  activeOrganizationId?: string | null,
) {
  if (activeOrganizationId) {
    return "/dashboard";
  }

  if (platformRole === "country_manager") {
    return "/admin/my-countries";
  }

  if (platformRole) {
    return "/admin";
  }

  return "/organizations";
}
