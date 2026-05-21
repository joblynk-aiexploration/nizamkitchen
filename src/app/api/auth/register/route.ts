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
import { createAcceptance, getRequiredLegalDocumentsForUser } from "@/server/legal/legal-service";
import { verifyRecaptcha } from "@/server/seo/seo-service";

const orgTypeMap: Record<string, OrganizationType> = {
  household: OrganizationType.household,
  chef: OrganizationType.chef_business,
  catering: OrganizationType.home_catering,
  restaurant: OrganizationType.restaurant,
};

const redirectAfterRegister: Record<string, string> = {
  household: "/household/preferences",
  chef: "/chef/profile",
  catering: "/catering/profile/setup",
  restaurant: "/restaurant",
};

export function getPostRegisterDestination(accountType: string, platformRole?: string | null) {
  if (platformRole === "platform_owner" || platformRole === "platform_admin") {
    return "/admin";
  }

  return redirectAfterRegister[accountType] ?? "/dashboard";
}

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
  const recaptcha = await verifyRecaptcha({
    token: formData.get("recaptchaToken")?.toString(),
    page: "register",
    ip: clientIp,
    countryCode: formData.get("countryCode")?.toString(),
  });
  if (!recaptcha.ok) {
    return NextResponse.redirect(new URL(`/register?message=${encodeURIComponent(recaptcha.reason)}`, request.url));
  }

  // formData.getAll for cuisineIds (multi-value checkbox)
  const cuisineIds = formData.getAll("cuisineIds");

  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationName: formData.get("organizationName"),
    countryCode: formData.get("countryCode"),
    accountType: formData.get("accountType") ?? "household",
    acceptLegalTerms: formData.get("acceptLegalTerms"),
    householdSize: formData.get("householdSize") ?? undefined,
    spiceLevel: formData.get("spiceLevel") ?? undefined,
    cuisineIds: cuisineIds.length > 0 ? cuisineIds : undefined,
  });

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL("/register?message=Invalid registration data.", request.url),
    );
  }

  if (parsed.data.acceptLegalTerms !== "on") {
    return NextResponse.redirect(new URL("/register?message=Please accept the required legal documents.", request.url));
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
  const organizationType = orgTypeMap[parsed.data.accountType] ?? OrganizationType.household;

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
        organizationType,
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

    if (organizationType === OrganizationType.household) {
      const size = parsed.data.householdSize ?? 4;
      await tx.householdProfile.create({
        data: {
          organizationId: organization.id,
          countryCode: country.countryCode,
          displayName: parsed.data.organizationName,
          defaultHouseholdSize: size,
          defaultServings: size,
          defaultSpiceLevel: parsed.data.spiceLevel ?? "medium",
          preferredMeasurementSystem: country.measurementSystem,
          preferredCuisineIds: parsed.data.cuisineIds ?? [],
          cookingSkillLevel: "beginner",
          weeklyCookingDays: [],
        },
      });
    } else if (organizationType === OrganizationType.home_catering) {
      await tx.homeCateringProfile.create({
        data: {
          organizationId: organization.id,
          countryCode: country.countryCode,
          displayName: parsed.data.organizationName,
          slug: `${slugify(parsed.data.organizationName)}-${Math.random().toString(36).slice(2, 8)}`,
          cuisineSpecialtiesJson: [],
          languagesJson: [],
          acceptsPickup: true,
          acceptsDelivery: false,
          acceptsPreorders: true,
        },
      });
    }

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

  if (organizationType === OrganizationType.home_catering) {
    await createAuditLog({
      actorUserId: result.user.id,
      organizationId: result.organization.id,
      countryCode: result.organization.countryCode,
      action: "home_catering_profile.created",
      targetType: "home_catering_profile",
      targetId: result.organization.id,
      details: { createdDuringRegistration: true },
      ...requestMeta,
    });
  }
  await createAuditLog({
    actorUserId: result.user.id,
    organizationId: result.organization.id,
    countryCode: result.organization.countryCode,
    action: "organization.created",
    targetType: "organization",
    targetId: result.organization.id,
    details: { organizationType },
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

  const requiredLegalDocuments = await getRequiredLegalDocumentsForUser({
    user: result.user,
    activeOrganization: result.organization,
  });
  await Promise.all(
    requiredLegalDocuments.map((document) =>
      createAcceptance({
        userId: result.user.id,
        organizationId: result.organization.id,
        documentId: document.id,
        ...requestMeta,
      }),
    ),
  );

  const destination = getPostRegisterDestination(parsed.data.accountType, result.user.platformRole);
  return NextResponse.redirect(new URL(destination, request.url));
}
