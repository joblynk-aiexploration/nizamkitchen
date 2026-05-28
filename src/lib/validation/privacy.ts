import { z } from "zod";

export const dataPrivacyRequestCreateSchema = z.object({
  requestType: z.enum([
    "user_export",
    "organization_export",
    "account_deletion",
    "organization_deletion",
    "anonymization",
    "file_deletion",
    "correction_request",
  ]),
  reason: z.string().trim().max(2000).optional(),
});

export const adminDataPrivacyRequestUpdateSchema = z.object({
  status: z.enum(["submitted", "reviewing", "processing", "completed", "rejected", "cancelled"]),
  adminNotes: z.string().trim().max(3000).optional(),
});

export const dataRetentionPolicySchema = z.object({
  id: z.string().optional(),
  countryCode: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : String(value).trim().toUpperCase()),
    z.string().length(2).nullable(),
  ),
  dataCategory: z.enum([
    "user_profile",
    "organization_profile",
    "orders",
    "payments",
    "files",
    "kyc_documents",
    "support_tickets",
    "audit_logs",
    "notifications",
    "marketing",
    "marketplace_profiles",
  ]),
  retentionDays: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int().positive().nullable(),
  ),
  action: z.enum(["retain", "archive", "anonymize", "delete"]),
  status: z.enum(["active", "disabled"]).default("active"),
  notes: z.string().trim().max(2000).optional(),
});

export const userPrivacySettingSchema = z.object({
  profileVisibility: z.enum(["private", "organization", "public"]).default("private"),
  activityRetentionDays: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
    z.number().int().positive().max(3650).nullable(),
  ),
  marketingEmailsEnabled: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  analyticsConsent: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  personalizedRecommendationsEnabled: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export type DataPrivacyRequestCreateInput = z.infer<typeof dataPrivacyRequestCreateSchema>;
export type DataRetentionPolicyInput = z.infer<typeof dataRetentionPolicySchema>;
export type UserPrivacySettingInput = z.infer<typeof userPrivacySettingSchema>;
