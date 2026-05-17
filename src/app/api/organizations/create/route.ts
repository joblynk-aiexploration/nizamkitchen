import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { AccessDeniedError, assertMembershipAccess } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/security";
import { getCurrentSession, getRequestMetadata } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { createOrganizationSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const clientIp = getClientIpFromHeaders(request.headers);

  try {
    enforceRateLimit({
      key: `organization-create:${clientIp}`,
      limit: 20,
      windowMs: 60_000,
    });
  } catch {
    return NextResponse.redirect(new URL("/organizations?message=Too many requests.", request.url));
  }

  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    assertMembershipAccess(session);
  } catch (error) {
    await createAuditLog({
      actorUserId: session.user.id,
      organizationId: session.activeOrganization?.id,
      countryCode: session.activeOrganization?.countryCode,
      action: "access.denied",
      targetType: "organization.create",
      details: {
        reason: error instanceof AccessDeniedError ? error.code : "UNKNOWN",
      },
      ...(await getRequestMetadata()),
    });
    return NextResponse.redirect(new URL("/dashboard?message=Access denied.", request.url));
  }

  const formData = await request.formData();
  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    countryCode: formData.get("countryCode"),
    organizationType: formData.get("organizationType"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/organizations?message=Invalid organization details.", request.url),
    );
  }

  const country = await prisma.country.findUnique({
    where: { countryCode: parsed.data.countryCode },
  });

  if (!country || !country.isActive) {
    return NextResponse.redirect(new URL("/organizations?message=Country not found.", request.url));
  }

  const organization = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      slug: `${slugify(parsed.data.name)}-${Math.random().toString(36).slice(2, 8)}`,
      organizationType: parsed.data.organizationType,
      organizationId: crypto.randomUUID(),
      countryCode: country.countryCode,
      currencyCode: country.currencyCode,
      defaultTimezone: country.defaultTimezone,
      defaultLocale: country.defaultLocale,
      measurementSystem: country.measurementSystem,
      memberships: {
        create: {
          userId: session.user.id,
          role: "org_owner",
          status: "active",
        },
      },
    },
  });

  await prisma.session.update({
    where: { id: session.id },
    data: { activeOrganizationId: organization.id },
  });

  const requestMeta = await getRequestMetadata();
  await createAuditLog({
    actorUserId: session.user.id,
    organizationId: organization.id,
    countryCode: organization.countryCode,
    action: "organization.created",
    targetType: "organization",
    targetId: organization.id,
    ...requestMeta,
  });
  await createAuditLog({
    actorUserId: session.user.id,
    organizationId: organization.id,
    countryCode: organization.countryCode,
    action: "membership.created",
    targetType: "membership",
    targetId: session.user.id,
    details: { role: "org_owner" },
    ...requestMeta,
  });

  return NextResponse.redirect(new URL("/organizations?message=Organization created.", request.url));
}
