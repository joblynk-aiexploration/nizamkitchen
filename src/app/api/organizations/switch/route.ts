import { NextResponse } from "next/server";
import { MembershipStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { getCurrentSession, getRequestMetadata } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { switchOrganizationSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();
  const parsed = switchOrganizationSchema.safeParse({
    organizationId: formData.get("organizationId"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/organizations?message=Invalid organization selection.", request.url),
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      organizationId: parsed.data.organizationId,
      status: MembershipStatus.active,
    },
  });

  if (!membership) {
    await createAuditLog({
      actorUserId: session.user.id,
      organizationId: session.activeOrganization?.id,
      countryCode: session.activeOrganization?.countryCode,
      action: "access.denied",
      targetType: "organization_switch",
      details: { requestedOrganizationId: parsed.data.organizationId },
      ...(await getRequestMetadata()),
    });
    return NextResponse.redirect(new URL("/organizations?message=Access denied.", request.url));
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { activeOrganizationId: membership.organizationId },
  });

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
