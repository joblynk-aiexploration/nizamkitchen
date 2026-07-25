import { z } from "zod";
import { isFormattedPhoneNumber } from "@/lib/phone";

const requestTypeValues = [
  "recipe",
  "meal_plan",
  "occasion",
  "weekly_cooking",
  "daily_cooking",
  "custom",
] as const;

const requestStatusValues = [
  "draft",
  "submitted",
  "reviewing",
  "matched",
  "quoted",
  "accepted",
  "declined",
  "cancelled",
  "completed",
] as const;

const genderPreferenceValues = ["no_preference", "female_preferred", "male_preferred"] as const;

const nullableString = (max = 500) =>
  z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(max).nullable(),
  );

const optionalLinkedId = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

const nullableMoney = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
  z.number().min(0).max(1_000_000).nullable(),
);

const nullablePositiveInt = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
  z.number().int().min(1).max(10000).nullable(),
);

const homeChefRequestBaseSchema = z.object({
    requestType: z.enum(requestTypeValues),
    title: z.string().trim().min(3).max(160),
    description: nullableString(1200).optional(),
    mealPlanId: optionalLinkedId,
    recipeId: optionalLinkedId,
    requestedDate: z.coerce.date(),
    requestedTimeWindow: nullableString(80).optional(),
    guestCount: z.coerce.number().int().min(1).max(10000),
    householdSize: nullablePositiveInt.optional(),
    serviceAddressLine1: nullableString(180).optional(),
    serviceAddressLine2: nullableString(180).optional(),
    city: nullableString(120).optional(),
    region: nullableString(120).optional(),
    postalCode: nullableString(40).optional(),
    phone: nullableString(40).optional().refine(isFormattedPhoneNumber, "Phone number must include a country code and a 10 digit number."),
    preferredLanguage: nullableString(80).optional(),
    genderPreference: z.enum(genderPreferenceValues).default("no_preference"),
    budgetAmount: nullableMoney.optional(),
    budgetCurrency: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? null : value),
      z.string().trim().toUpperCase().length(3).nullable(),
    ).optional(),
    notes: nullableString(1500).optional(),
    submit: z.coerce.boolean().default(false),
  });

function validateLinkedContext(
  value: { requestType?: string; recipeId?: string; mealPlanId?: string; requestedDate?: Date },
  ctx: z.RefinementCtx,
) {
    if (value.requestedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (value.requestedDate < today) {
        ctx.addIssue({
          code: "custom",
          path: ["requestedDate"],
          message: "Requested date cannot be in the past.",
        });
      }
    }

    if (value.requestType === "recipe" && !value.recipeId) {
      ctx.addIssue({
        code: "custom",
        path: ["recipeId"],
        message: "Recipe requests must reference a recipe.",
      });
    }

    if (value.requestType === "meal_plan" && !value.mealPlanId) {
      ctx.addIssue({
        code: "custom",
        path: ["mealPlanId"],
        message: "Meal plan requests must reference a meal plan.",
      });
    }
}

function validateSubmittedAddress(
  value: { submit?: boolean; serviceAddressLine1?: string | null; city?: string | null; region?: string | null },
  ctx: z.RefinementCtx,
) {
  if (!value.submit) return;
  if (!value.serviceAddressLine1) {
    ctx.addIssue({ code: "custom", path: ["serviceAddressLine1"], message: "Enter the home street address." });
  }
  if (!value.city) {
    ctx.addIssue({ code: "custom", path: ["city"], message: "Enter the city for this home chef request." });
  }
  if (!value.region) {
    ctx.addIssue({ code: "custom", path: ["region"], message: "Enter the state or region for this home chef request." });
  }
}

function validateHomeChefRequest(
  value: { requestType?: string; recipeId?: string; mealPlanId?: string; requestedDate?: Date; submit?: boolean; serviceAddressLine1?: string | null; city?: string | null; region?: string | null },
  ctx: z.RefinementCtx,
) {
  validateLinkedContext(value, ctx);
  validateSubmittedAddress(value, ctx);
}

export const homeChefRequestCreateSchema = homeChefRequestBaseSchema.superRefine(validateHomeChefRequest);

export const homeChefRequestUpdateSchema = homeChefRequestBaseSchema.partial().superRefine(validateHomeChefRequest);

export const homeChefRequestMessageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  isInternal: z.coerce.boolean().default(false),
});

export const homeChefRequestStatusSchema = z.object({
  status: z.enum(requestStatusValues),
  note: nullableString(800).optional(),
});

export const homeChefRequestAssignmentSchema = z.object({
  assignedChefOrganizationId: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().min(1).nullable(),
  ),
  note: nullableString(800).optional(),
});

export type HomeChefRequestCreateInput = z.infer<typeof homeChefRequestCreateSchema>;
export type HomeChefRequestUpdateInput = z.infer<typeof homeChefRequestUpdateSchema>;
export type HomeChefRequestMessageInput = z.infer<typeof homeChefRequestMessageSchema>;
export type HomeChefRequestStatusInput = z.infer<typeof homeChefRequestStatusSchema>;
