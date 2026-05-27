import { z } from "zod";

const supportedModuleValues = [
  "recipes",
  "meal_planner",
  "grocery_engine",
  "youtube_references",
  "home_chefs",
  "home_catering",
  "restaurant_fallback",
  "grocery_partners",
  "menus",
  "restaurant_profiles",
  "payments",
  "subscriptions",
  "ai_suggestions",
  "country_specific_recipes",
  "chef_verification",
  "family_profiles",
  "occasion_planning",
  "ramadan_mode",
  "eid_mode",
] as const;

const measurementSystemValues = ["metric", "imperial", "mixed"] as const;
const organizationStatusValues = ["active", "paused", "suspended", "disabled"] as const;
const userStatusValues = ["active", "suspended", "disabled"] as const;
const platformRoleValues = [
  "platform_owner",
  "platform_admin",
  "country_manager",
  "support_admin",
  "auditor",
] as const;

export const countryCreateSchema = z.object({
  countryCode: z.string().trim().toUpperCase().length(2),
  countryName: z.string().trim().min(2).max(120),
  currencyCode: z.string().trim().toUpperCase().min(3).max(3),
  defaultTimezone: z.string().trim().min(3).max(120),
  defaultLocale: z.string().trim().min(2).max(20),
  measurementSystem: z.enum(measurementSystemValues),
  phoneCountryCode: z.string().trim().min(1).max(8),
  isActive: z.coerce.boolean().default(true),
  supportedModules: z.array(z.enum(supportedModuleValues)).default([]),
  managerUserIds: z.array(z.string().min(1)).default([]),
});

export const countryUpdateSchema = countryCreateSchema.omit({
  countryCode: true,
  countryName: true,
}).extend({
  countryName: z.string().trim().min(2).max(120).optional(),
  managerUserIds: z.array(z.string().min(1)).default([]),
});

export const countryManagerUpdateSchema = z.object({
  defaultTimezone: z.string().trim().min(3).max(120),
  defaultLocale: z.string().trim().min(2).max(20),
  measurementSystem: z.enum(measurementSystemValues),
  phoneCountryCode: z.string().trim().min(1).max(8),
  supportedModules: z.array(z.enum(supportedModuleValues)).default([]),
});

export const organizationStatusUpdateSchema = z.object({
  status: z.enum(organizationStatusValues),
  reason: z.string().trim().max(300).optional(),
});

export const organizationMetadataUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120),
  currencyCode: z.string().trim().toUpperCase().min(3).max(3),
  defaultTimezone: z.string().trim().min(3).max(120),
  defaultLocale: z.string().trim().min(2).max(20),
  measurementSystem: z.enum(measurementSystemValues),
  organizationType: z.enum([
    "household",
    "chef_business",
    "home_catering",
    "restaurant",
    "grocery_partner",
    "internal_admin",
  ]),
});

export const userStatusUpdateSchema = z.object({
  status: z.enum(userStatusValues),
  reason: z.string().trim().max(300).optional(),
});

export const platformRoleUpdateSchema = z.object({
  platformRole: z.preprocess(
    (value) => (value === "" ? null : value),
    z.enum(platformRoleValues).nullable(),
  ),
});

export const adminUserCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.email().trim().toLowerCase().max(255),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
  status: z.enum(userStatusValues).default("active"),
  platformRole: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.enum(platformRoleValues).nullable(),
  ),
  organizationId: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().min(1).nullable(),
  ).optional(),
  organizationRole: z.enum([
    "org_owner",
    "org_admin",
    "member",
    "household_member",
    "chef_owner",
    "chef_staff",
    "home_catering_owner",
    "home_catering_staff",
    "restaurant_owner",
    "restaurant_staff",
    "grocery_partner_admin",
  ]).default("member"),
  countryCodes: z.array(z.string().trim().toUpperCase().length(2)).default([]),
});

export const featureFlagCreateSchema = z.object({
  key: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
  enabled: z.coerce.boolean().default(false),
  scopeType: z.enum(["global", "country", "organization"]),
  countryCode: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().toUpperCase().length(2).optional(),
  ),
  organizationId: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().min(1).optional(),
  ),
});

export const featureFlagUpdateSchema = featureFlagCreateSchema.partial({
  key: true,
  name: true,
  description: true,
  countryCode: true,
  organizationId: true,
}).extend({
  enabled: z.coerce.boolean(),
  scopeType: z.enum(["global", "country", "organization"]),
});

export const systemSettingUpdateSchema = z.object({
  key: z.string().trim().min(2).max(120),
  value: z.string().trim().min(1),
  description: z.string().trim().max(300).optional(),
});

export const adminAuditLogFilterSchema = z.object({
  action: z.string().trim().optional(),
  actorUserId: z.string().trim().optional(),
  organizationId: z.string().trim().optional(),
  countryCode: z.string().trim().toUpperCase().optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  logId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export type SupportedModuleValue = (typeof supportedModuleValues)[number];
