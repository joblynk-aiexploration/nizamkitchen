import { IntegrationCategory, IntegrationEnvironment, IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { z } from "zod";

const listSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => {
    if (Array.isArray(value)) {
      return value.map((item) => item.trim()).filter(Boolean);
    }

    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  });

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const jsonObjectFromStringSchema = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) {
      return undefined;
    }

    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Settings JSON must be valid JSON." });
      return z.NEVER;
    }
  })
  .pipe(z.record(z.string(), jsonValueSchema).optional());

export const platformIntegrationSchema = z.object({
  id: z.string().optional(),
  provider: z.nativeEnum(IntegrationProvider),
  category: z.nativeEnum(IntegrationCategory),
  displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.nativeEnum(IntegrationStatus).default(IntegrationStatus.draft),
  environment: z.nativeEnum(IntegrationEnvironment).default(IntegrationEnvironment.production),
  countryCode: z.string().trim().length(2).toUpperCase().optional().or(z.literal("")),
  region: z.string().trim().max(120).optional().or(z.literal("")),
  isGlobal: z.coerce.boolean().default(true),
  isDefault: z.coerce.boolean().default(false),
});

export const platformIntegrationCredentialSchema = z.object({
  integrationId: z.string().min(1),
  keyName: z.string().trim().min(2).max(120).regex(/^[a-zA-Z0-9_.-]+$/),
  secretValue: z.string().trim().min(2).max(10_000),
  isPublicClientValue: z.coerce.boolean().default(false),
});

export const platformIntegrationSettingSchema = z.object({
  integrationId: z.string().min(1),
  settingKey: z.string().trim().min(2).max(120).regex(/^[a-zA-Z0-9_.-]+$/),
  settingValueJson: jsonObjectFromStringSchema,
  settingValueText: z.string().trim().optional(),
  isSecret: z.coerce.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.settingValueJson !== undefined) {
    return;
  }

  if (!value.settingValueText) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["settingValueText"], message: "Enter a value or valid JSON." });
    return;
  }
});

export const platformIntegrationTestSchema = z.object({
  integrationId: z.string().min(1),
  testType: z.string().trim().min(2).max(120),
});

export const platformIntegrationTemplateSchema = z.object({
  provider: z.nativeEnum(IntegrationProvider),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
});

export function normalizeSettingValue(input: z.infer<typeof platformIntegrationSettingSchema>) {
  if (input.settingValueJson !== undefined) {
    return input.settingValueJson;
  }

  if (input.settingValueText === "true") {
    return true;
  }
  if (input.settingValueText === "false") {
    return false;
  }

  const numberValue = Number(input.settingValueText);
  if (input.settingValueText && Number.isFinite(numberValue) && input.settingValueText.trim() !== "") {
    return numberValue;
  }

  return input.settingValueText ?? "";
}

export function splitList(value: string | string[]) {
  return listSchema.parse(value);
}
