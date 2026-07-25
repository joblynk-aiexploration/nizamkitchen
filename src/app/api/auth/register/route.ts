import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { MeasurementSystem, OrganizationType } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { withAnalyticsEvent } from "@/lib/analytics/events";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getClientIpFromHeaders } from "@/lib/security";
import { createSession, getRequestMetadata } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { getRegistrationValidationMessage, registerSchema } from "@/lib/validation/auth";
import { createAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { ensureCoreRegistrationCountries } from "@/server/auth/registration-countries";
import { createAcceptance, getRequiredLegalDocumentsForUser } from "@/server/legal/legal-service";
import { getActiveBillingPlanBySlug } from "@/server/billing/plans";
import { createStripeSubscriptionCheckout } from "@/server/payments/providers/stripe/stripe-adapter";
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

const FREE_ACCOUNT_READY_MESSAGE = "Your free account is ready. Welcome to NizamKitchen.";
const PLAN_UNAVAILABLE_MESSAGE = "Your account is ready, but that pricing plan is no longer available. You can choose another plan from Billing when you are ready.";
const CHECKOUT_UNAVAILABLE_MESSAGE = "Your account is ready. We could not open secure checkout right now, but you can continue and choose a paid plan from Billing anytime.";

function measurementSystemForSignup(country: { countryCode: string; measurementSystem: MeasurementSystem }) {
  return country.countryCode === "US" ? MeasurementSystem.imperial : country.measurementSystem;
}

export function getPostRegisterDestination(accountType: string, platformRole?: string | null) {
  if (platformRole === "platform_owner" || platformRole === "platform_admin") {
    return "/admin";
  }

  return redirectAfterRegister[accountType] ?? "/dashboard";
}

function destinationWithMessage(destination: string, message: string, baseUrl: string) {
  const url = new URL(destination, baseUrl);
  url.searchParams.set("message", message);
  url.searchParams.set("analytics_event", "sign_up");
  return url;
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
    cateringOperationType: formData.get("cateringOperationType") ?? "home_caterer",
    restaurantName: formData.get("restaurantName") ?? undefined,
    restaurantAddress: formData.get("restaurantAddress") ?? undefined,
    restaurantLicense: formData.get("restaurantLicense") ?? undefined,
    acceptLegalTerms: formData.get("acceptLegalTerms"),
    selectedPlanSlug: formData.get("selectedPlanSlug") ?? undefined,
    householdSize: formData.get("householdSize") ?? undefined,
    spiceLevel: formData.get("spiceLevel") ?? undefined,
    cuisineIds: cuisineIds.length > 0 ? cuisineIds : undefined,
  });

  if (!parsed.success) {
    const message = getRegistrationValidationMessage(parsed.error);
    return NextResponse.redirect(
      new URL(`/register?message=${encodeURIComponent(message)}`, request.url),
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

  let country = await prisma.country.findUnique({
    where: { countryCode: parsed.data.countryCode },
  });

  if (!country || !country.isActive) {
    await ensureCoreRegistrationCountries().catch(() => null);
    country = await prisma.country.findUnique({
      where: { countryCode: parsed.data.countryCode },
    });
  }

  if (!country || !country.isActive) {
    return NextResponse.redirect(new URL("/register?message=That country is not available yet. Please choose a country from the list.", request.url));
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const slug = `${slugify(parsed.data.organizationName)}-${Math.random().toString(36).slice(2, 8)}`;
  const organizationType = orgTypeMap[parsed.data.accountType] ?? OrganizationType.household;
  const signupMeasurementSystem = measurementSystemForSignup(country);

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
        measurementSystem: signupMeasurementSystem,
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
          preferredMeasurementSystem: signupMeasurementSystem,
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
          operationType: parsed.data.cateringOperationType,
          restaurantName: parsed.data.cateringOperationType === "restaurant_caterer" ? parsed.data.restaurantName ?? null : null,
          restaurantAddress: parsed.data.cateringOperationType === "restaurant_caterer" ? parsed.data.restaurantAddress ?? null : null,
          restaurantLicense: parsed.data.cateringOperationType === "restaurant_caterer" ? parsed.data.restaurantLicense ?? null : null,
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
  const selectedPlanSlug = parsed.data.selectedPlanSlug?.trim();
  if (selectedPlanSlug === "free") {
    return NextResponse.redirect(destinationWithMessage(destination, FREE_ACCOUNT_READY_MESSAGE, request.url));
  }
  if (selectedPlanSlug) {
    const plan = await getActiveBillingPlanBySlug(selectedPlanSlug);
    if (!plan) {
      return NextResponse.redirect(
        new URL(`/billing/plans?message=${encodeURIComponent(PLAN_UNAVAILABLE_MESSAGE)}`, request.url),
      );
    }
    if (Number(plan.priceAmount) <= 0) {
      return NextResponse.redirect(destinationWithMessage(destination, FREE_ACCOUNT_READY_MESSAGE, request.url));
    }

    try {
      const checkout = await createStripeSubscriptionCheckout({
        organizationId: result.organization.id,
        userId: result.user.id,
        planId: plan.id,
        appUrl: env.APP_URL,
      });
      if (checkout.checkoutUrl) {
        return NextResponse.redirect(checkout.checkoutUrl);
      }
    } catch (error) {
      console.error("Unable to start checkout after registration", error);
    }

    return NextResponse.redirect(
      new URL(`/billing/plans?message=${encodeURIComponent(CHECKOUT_UNAVAILABLE_MESSAGE)}`, request.url),
    );
  }
  return NextResponse.redirect(new URL(withAnalyticsEvent(destination, "sign_up"), request.url));
}
