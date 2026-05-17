import crypto from "node:crypto";
import {
  MeasurementSystem,
  MembershipStatus,
  OrganizationStatus,
  OrganizationType,
  PlatformRole,
  PrismaClient,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FEATURE_FLAGS = [
  "recipes",
  "meal_planner",
  "grocery_engine",
  "youtube_references",
  "home_chefs",
  "restaurant_fallback",
  "grocery_partners",
  "payments",
  "subscriptions",
  "ai_suggestions",
];

const COUNTRY_SEEDS = [
  { countryCode: "US", countryName: "United States", currencyCode: "USD", defaultTimezone: "America/Chicago", defaultLocale: "en-US", measurementSystem: MeasurementSystem.imperial, phoneCountryCode: "+1" },
  { countryCode: "IN", countryName: "India", currencyCode: "INR", defaultTimezone: "Asia/Kolkata", defaultLocale: "en-IN", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+91" },
  { countryCode: "GB", countryName: "United Kingdom", currencyCode: "GBP", defaultTimezone: "Europe/London", defaultLocale: "en-GB", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+44" },
  { countryCode: "SA", countryName: "Saudi Arabia", currencyCode: "SAR", defaultTimezone: "Asia/Riyadh", defaultLocale: "ar-SA", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+966" },
  { countryCode: "AE", countryName: "United Arab Emirates", currencyCode: "AED", defaultTimezone: "Asia/Dubai", defaultLocale: "ar-AE", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+971" },
  { countryCode: "CA", countryName: "Canada", currencyCode: "CAD", defaultTimezone: "America/Toronto", defaultLocale: "en-CA", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+1" },
  { countryCode: "AU", countryName: "Australia", currencyCode: "AUD", defaultTimezone: "Australia/Sydney", defaultLocale: "en-AU", measurementSystem: MeasurementSystem.metric, phoneCountryCode: "+61" },
];

const USER_SEEDS = [
  { email: "owner@nizamkitchen.dev", fullName: "Platform Owner", platformRole: PlatformRole.platform_owner },
  { email: "admin@nizamkitchen.dev", fullName: "Platform Admin", platformRole: PlatformRole.platform_admin },
  { email: "country@nizamkitchen.dev", fullName: "Country Manager", platformRole: PlatformRole.country_manager },
  { email: "household@nizamkitchen.dev", fullName: "Household Owner", platformRole: null },
  { email: "chef@nizamkitchen.dev", fullName: "Chef Owner", platformRole: null },
  { email: "restaurant@nizamkitchen.dev", fullName: "Restaurant Owner", platformRole: null },
];

function slugify(input: string) {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function upsertUser(email: string, fullName: string, platformRole: PlatformRole | null, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { fullName, platformRole, passwordHash },
    create: { email, fullName, platformRole, passwordHash },
  });
}

async function createOrganization(params: { name: string; organizationType: OrganizationType; countryCode: string; ownerUserId: string; }) {
  const country = await prisma.country.findUniqueOrThrow({ where: { countryCode: params.countryCode } });
  const organization = await prisma.organization.upsert({
    where: { slug: slugify(params.name) },
    update: {
      organizationType: params.organizationType,
      status: OrganizationStatus.active,
      countryCode: country.countryCode,
      currencyCode: country.currencyCode,
      defaultTimezone: country.defaultTimezone,
      defaultLocale: country.defaultLocale,
      measurementSystem: country.measurementSystem,
    },
    create: {
      name: params.name,
      slug: slugify(params.name),
      organizationId: crypto.randomUUID(),
      organizationType: params.organizationType,
      status: OrganizationStatus.active,
      countryCode: country.countryCode,
      currencyCode: country.currencyCode,
      defaultTimezone: country.defaultTimezone,
      defaultLocale: country.defaultLocale,
      measurementSystem: country.measurementSystem,
    },
  });

  const role = params.organizationType === OrganizationType.household ? "org_owner" : params.organizationType === OrganizationType.chef_business ? "chef_owner" : "restaurant_owner";
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: params.ownerUserId, organizationId: organization.id } },
    update: { role, status: MembershipStatus.active },
    create: { userId: params.ownerUserId, organizationId: organization.id, role, status: MembershipStatus.active },
  });

  return organization;
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  for (const country of COUNTRY_SEEDS) {
    await prisma.country.upsert({
      where: { countryCode: country.countryCode },
      update: { ...country, supportedModules: FEATURE_FLAGS, isActive: true },
      create: { ...country, supportedModules: FEATURE_FLAGS, isActive: true },
    });
  }

  const users = new Map<string, Awaited<ReturnType<typeof upsertUser>>>();
  for (const user of USER_SEEDS) {
    const record = await upsertUser(user.email, user.fullName, user.platformRole, passwordHash);
    users.set(user.email, record);
  }

  await prisma.countryAssignment.upsert({
    where: { userId_countryCode: { userId: users.get("country@nizamkitchen.dev")!.id, countryCode: "US" } },
    update: {},
    create: { userId: users.get("country@nizamkitchen.dev")!.id, countryCode: "US" },
  });

  const householdOrg = await createOrganization({ name: "Nizam Family Kitchen", organizationType: OrganizationType.household, countryCode: "US", ownerUserId: users.get("household@nizamkitchen.dev")!.id });
  const chefOrg = await createOrganization({ name: "Hyderabad Home Chefs Demo", organizationType: OrganizationType.chef_business, countryCode: "US", ownerUserId: users.get("chef@nizamkitchen.dev")!.id });
  const restaurantOrg = await createOrganization({ name: "Biryani House Demo", organizationType: OrganizationType.restaurant, countryCode: "US", ownerUserId: users.get("restaurant@nizamkitchen.dev")!.id });

  for (const key of FEATURE_FLAGS) {
    const existing = await prisma.featureFlag.findFirst({ where: { key, organizationId: null, countryCode: null } });
    if (existing) {
      await prisma.featureFlag.update({ where: { id: existing.id }, data: { name: key.replace(/_/g, " "), description: `Placeholder flag for ${key}.`, enabled: false } });
    } else {
      await prisma.featureFlag.create({ data: { key, name: key.replace(/_/g, " "), description: `Placeholder flag for ${key}.`, enabled: false } });
    }
  }

  const existingSubscription = await prisma.billingSubscription.findFirst({ where: { organizationId: householdOrg.id, planCode: "foundation-trial" } });
  if (!existingSubscription) {
    await prisma.billingSubscription.create({
      data: {
        organizationId: householdOrg.id,
        countryCode: "US",
        provider: "placeholder",
        status: "trialing",
        planCode: "foundation-trial",
        currencyCode: "USD",
        billingPeriod: "monthly",
      },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: "platform.default_support_email" },
    update: { value: "support@nizamkitchen.dev" },
    create: {
      key: "platform.default_support_email",
      value: "support@nizamkitchen.dev",
      description: "Support inbox for the platform foundation environment.",
    },
  });

  const auditItems = [
    { actorUserId: users.get("owner@nizamkitchen.dev")!.id, action: "setting.updated", targetType: "system_setting", targetId: "platform.default_support_email" },
    { actorUserId: users.get("admin@nizamkitchen.dev")!.id, action: "billing.updated", organizationId: householdOrg.id, countryCode: "US", targetType: "billing_subscription", targetId: "foundation-trial" },
    { actorUserId: users.get("owner@nizamkitchen.dev")!.id, action: "feature_flag.updated", targetType: "feature_flag", targetId: "recipes" },
    { actorUserId: users.get("household@nizamkitchen.dev")!.id, organizationId: householdOrg.id, countryCode: "US", action: "organization.created", targetType: "organization", targetId: householdOrg.id },
    { actorUserId: users.get("chef@nizamkitchen.dev")!.id, organizationId: chefOrg.id, countryCode: "US", action: "organization.created", targetType: "organization", targetId: chefOrg.id },
    { actorUserId: users.get("restaurant@nizamkitchen.dev")!.id, organizationId: restaurantOrg.id, countryCode: "US", action: "organization.created", targetType: "organization", targetId: restaurantOrg.id },
  ];

  for (const item of auditItems) {
    const exists = await prisma.auditLog.findFirst({ where: { action: item.action, targetType: item.targetType, targetId: item.targetId } });
    if (!exists) {
      await prisma.auditLog.create({ data: item });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
