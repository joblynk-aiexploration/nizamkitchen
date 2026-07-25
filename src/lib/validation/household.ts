import { z } from "zod";

const spiceLevelValues = ["mild", "medium", "hot", "extra_hot"] as const;
const measurementSystemValues = ["metric", "imperial", "mixed"] as const;
const cookingSkillLevelValues = ["beginner", "intermediate", "advanced", "expert"] as const;
const avoidedIngredientSeverityValues = ["preference", "avoid", "strict"] as const;
const preferredDeliveryMethodValues = ["pickup", "delivery", "in_store", "no_preference"] as const;
const weeklyCookingDayValues = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const nullablePositiveInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().min(0).max(100).nullable(),
);

export const householdProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().toUpperCase().length(2),
  defaultHouseholdSize: z.coerce.number().int().min(1).max(100),
  adultsCount: nullablePositiveInt.optional(),
  childrenCount: nullablePositiveInt.optional(),
  defaultServings: z.coerce.number().int().min(1).max(100),
  defaultSpiceLevel: z.enum(spiceLevelValues),
  preferredMeasurementSystem: z.enum(measurementSystemValues),
  preferredCuisineIds: z.array(z.string().min(1)).max(30).default([]),
  cookingSkillLevel: z.enum(cookingSkillLevelValues),
  weeklyCookingDays: z.array(z.enum(weeklyCookingDayValues)).max(7).default([]),
  groceryBudgetAmount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().min(0).max(1_000_000).nullable(),
  ).optional(),
  groceryBudgetCurrency: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.string().trim().toUpperCase().length(3).nullable(),
  ).optional(),
  notes: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(1500).optional(),
  ),
});

export const avoidedIngredientCreateSchema = z.object({
  ingredientId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().min(1).optional(),
  ),
  ingredientName: z.string().trim().min(1).max(120),
  reason: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(300).optional(),
  ),
  severity: z.enum(avoidedIngredientSeverityValues).default("avoid"),
});

export const favoriteRecipeSchema = z.object({
  recipeId: z.string().min(1),
  recipientUserId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.string().min(1).nullable(),
  ).optional(),
  targetServings: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1, "Enter at least 1 serving.").max(100, "Serving count must be 100 or less.").optional(),
  ),
});

export const householdMemberAccountSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the family member's name.").max(160),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
});

export const pantryItemSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().positive().nullable(),
  ).optional(),
  unitId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.string().min(1).nullable(),
  ).optional(),
  notes: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(500).optional(),
  ),
  expiresAt: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : new Date(String(v))),
    z.date().nullable(),
  ).optional(),
});

export const shoppingPreferenceSchema = z.object({
  preferredStoreName: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(120).optional(),
  ),
  preferredShoppingDay: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.enum(weeklyCookingDayValues).optional(),
  ),
  preferredDeliveryMethod: z.enum(preferredDeliveryMethodValues).default("no_preference"),
  notes: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().max(800).optional(),
  ),
});

export type HouseholdProfileInput = z.infer<typeof householdProfileSchema>;
export type HouseholdMemberAccountInput = z.infer<typeof householdMemberAccountSchema>;
export type AvoidedIngredientCreateInput = z.infer<typeof avoidedIngredientCreateSchema>;
export type PantryItemInput = z.infer<typeof pantryItemSchema>;
export type ShoppingPreferenceInput = z.infer<typeof shoppingPreferenceSchema>;
