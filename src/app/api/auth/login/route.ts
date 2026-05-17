import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { createSession, getRequestMetadata } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
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

  const activeMembership = user.memberships[0];
  await createSession(user.id, activeMembership?.organizationId);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createAuditLog({
    actorUserId: user.id,
    organizationId: activeMembership?.organizationId,
    action: "user.login",
    targetType: "session",
    targetId: user.id,
    ...(await getRequestMetadata()),
  });

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
