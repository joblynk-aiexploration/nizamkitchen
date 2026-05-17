import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { OrganizationType } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/security";
import { createSession, getRequestMetadata } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { registerSchema } from "@/lib/validation/auth";
import { createAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const clientIp = getClientIpFromHeaders(request.headers);

  try {
    enforceRateLimit({
      key: `register:${clientIp}`,
      limit: 5,
      windowMs: 60_000,
    });
  } catch {
    return NextResponse.redirect(new URL("/register?message=Too many requests.", request.url));
  }

  const formData = await request.formData();
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationName: formData.get("organizationName"),
    countryCode: formData.get("countryCode"),
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/register?message=Invalid registration data.", request.url),
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existingUser) {
    return NextResponse.redirect(new URL("/register?message=Email already exists.", request.url));
  }

  const country = await prisma.country.findUnique({
    where: { countryCode: parsed.data.countryCode },
  });

  if (!country || !country.isActive) {
    return NextResponse.redirect(new URL("/register?message=Invalid country selected.", request.url));
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const slug = `${slugify(parsed.data.organizationName)}-${Math.random().toString(36).slice(2, 8)}`;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        passwordHash,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: parsed.data.organizationName,
        slug,
        organizationType: OrganizationType.household,
        organizationId: crypto.randomUUID(),
        countryCode: country.countryCode,
        currencyCode: country.currencyCode,
        defaultTimezone: country.defaultTimezone,
        defaultLocale: country.defaultLocale,
        measurementSystem: country.measurementSystem,
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "org_owner",
        status: "active",
      },
    });

    return { user, organization };
  });

  await createSession(result.user.id, result.organization.id);
  const requestMeta = await getRequestMetadata();
  await createAuditLog({
    actorUserId: result.user.id,
    organizationId: result.organization.id,
    countryCode: result.organization.countryCode,
    action: "user.registered",
    targetType: "user",
    targetId: result.user.id,
    ...requestMeta,
  });
  await createAuditLog({
    actorUserId: result.user.id,
    organizationId: result.organization.id,
    countryCode: result.organization.countryCode,
    action: "organization.created",
    targetType: "organization",
    targetId: result.organization.id,
    ...requestMeta,
  });
  await createAuditLog({
    actorUserId: result.user.id,
    organizationId: result.organization.id,
    countryCode: result.organization.countryCode,
    action: "membership.created",
    targetType: "membership",
    targetId: result.user.id,
    details: { role: "org_owner" },
    ...requestMeta,
  });

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
