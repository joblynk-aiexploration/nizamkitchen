import { z } from "zod";

const mealPlanStatusValues = ["draft", "active", "completed", "archived"] as const;
const mealPlanEntryStatusValues = ["planned", "cooked", "skipped", "ordered_instead", "replaced"] as const;
const mealTypeValues = ["breakfast", "lunch", "dinner", "snack", "dessert", "side", "prep"] as const;
const spiceLevelValues = ["mild", "medium", "hot", "extra_hot"] as const;
const measurementSystemValues = ["metric", "imperial", "mixed"] as const;
const weeklyCookingDayValues = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const isoDateSchema = z.string().date();

const mealPlanBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  householdSize: z.coerce.number().int().min(1).max(100),
  notes: z.string().trim().max(2000).optional(),
});

export const mealPlanCreateSchema = mealPlanBaseSchema.superRefine((value, ctx) => {
  const startDate = new Date(`${value.startDate}T00:00:00.000Z`);
  const endDate = new Date(`${value.endDate}T00:00:00.000Z`);
  if (endDate < startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date must be on or after the start date.",
    });
  }
  const dayCount = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (dayCount > 31) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "Meal plans can span at most 31 days.",
    });
  }
});

export const mealPlanUpdateSchema = mealPlanBaseSchema.partial().extend({
  status: z.enum(mealPlanStatusValues).optional(),
}).superRefine((value, ctx) => {
  if (!value.startDate || !value.endDate) {
    return;
  }

  const startDate = new Date(`${value.startDate}T00:00:00.000Z`);
  const endDate = new Date(`${value.endDate}T00:00:00.000Z`);
  if (endDate < startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date must be on or after the start date.",
    });
  }
});

const mealPlanEntryBaseSchema = z.object({
  mealPlanDayId: z.string().cuid(),
  recipeId: z.string().cuid().optional(),
  customMealName: z.string().trim().min(1).max(140).optional(),
  mealType: z.enum(mealTypeValues),
  targetServings: z.coerce.number().int().min(1).max(100),
  notes: z.string().trim().max(1000).optional(),
  status: z.enum(mealPlanEntryStatusValues).default("planned"),
});

export const mealPlanEntryCreateSchema = mealPlanEntryBaseSchema.superRefine((value, ctx) => {
  if (!value.recipeId && !value.customMealName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customMealName"],
      message: "Provide either a recipe or a custom meal name.",
    });
  }
});

export const mealPlanEntryUpdateSchema = mealPlanEntryBaseSchema
  .omit({ mealPlanDayId: true })
  .partial()
  .extend({
    displayOrder: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.recipeId === undefined && value.customMealName === undefined) {
      return;
    }

    if (value.recipeId === undefined && !value.customMealName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customMealName"],
        message: "Provide either a recipe or a custom meal name.",
      });
    }
  });

export const mealPlanPreferenceSchema = z.object({
  defaultHouseholdSize: z.coerce.number().int().min(1).max(100).nullable().optional(),
  defaultCountryCode: z.string().trim().toUpperCase().length(2).nullable().optional(),
  preferredCuisines: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  avoidedIngredients: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  spicePreference: z.enum(spiceLevelValues).nullable().optional(),
  dietaryNotes: z.string().trim().max(1500).nullable().optional(),
  weeklyCookingDays: z.array(z.enum(weeklyCookingDayValues)).max(7).default([]),
  measurementSystem: z.enum(measurementSystemValues).nullable().optional(),
});

export const mealPlanDuplicateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  startDate: isoDateSchema.optional(),
});

export type MealPlanCreateInput = z.infer<typeof mealPlanCreateSchema>;
export type MealPlanUpdateInput = z.infer<typeof mealPlanUpdateSchema>;
export type MealPlanEntryCreateInput = z.infer<typeof mealPlanEntryCreateSchema>;
export type MealPlanEntryUpdateInput = z.infer<typeof mealPlanEntryUpdateSchema>;
export type MealPlanPreferenceInput = z.infer<typeof mealPlanPreferenceSchema>;
