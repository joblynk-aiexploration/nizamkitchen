import { NextResponse } from "next/server";
import { AccessDeniedError, assertUserCanAuthenticate } from "@/lib/auth";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/security";
import { createSession, getRequestMetadata } from "@/lib/session";
import { loginSchema } from "@/lib/validation/auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const clientIp = getClientIpFromHeaders(request.headers);

  try {
    enforceRateLimit({
      key: `login:${clientIp}`,
      limit: 10,
      windowMs: 60_000,
    });
  } catch {
    return NextResponse.redirect(new URL("/login?message=Too many requests.", request.url));
  }

  const formData = await request.formData();
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login?message=Invalid credentials.", request.url));
  }

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
    return NextResponse.redirect(new URL("/login?message=Invalid credentials.", request.url));
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
    return NextResponse.redirect(new URL("/login?message=Invalid credentials.", request.url));
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

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
