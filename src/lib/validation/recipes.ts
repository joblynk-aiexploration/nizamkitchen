import { z } from "zod";

const ingredientCategoryValues = [
  "vegetable", "fruit", "meat", "poultry", "seafood", "dairy",
  "grain", "lentil", "spice", "herb", "oil", "condiment",
  "nut", "sweetener", "beverage", "packaged", "other",
] as const;

const recipeDifficultyValues = ["easy", "medium", "hard", "expert"] as const;
const spiceLevelValues = ["mild", "medium", "hot", "extra_hot"] as const;
const recipeVisibilityValues = ["global", "organization", "private"] as const;
const recipeSourceTypeValues = ["platform", "organization", "imported", "user_created"] as const;
const mediaReferenceTypeValues = ["youtube", "image", "article", "other"] as const;
const unitTypeValues = ["mass", "volume", "count", "length", "package", "custom"] as const;
const unitSystemValues = ["metric", "imperial", "mixed", "traditional"] as const;

// ─── Ingredient ───────────────────────────────────────────────────────────────

export const ingredientCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  canonicalName: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  category: z.enum(ingredientCategoryValues),
  defaultUnitId: z.string().trim().min(1).optional(),
  densityGramPerMl: z.number().positive().optional(),
  averagePieceWeightGrams: z.number().positive().optional(),
  isGlobal: z.boolean().default(true),
  isActive: z.boolean().default(true),
  organizationId: z.string().trim().min(1).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
});

export const ingredientUpdateSchema = ingredientCreateSchema.partial();

// ─── Ingredient Alias ─────────────────────────────────────────────────────────

export const ingredientAliasCreateSchema = z.object({
  ingredientId: z.string().trim().min(1),
  alias: z.string().trim().min(1).max(120),
  language: z.string().trim().min(2).max(10).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  confidence: z.number().min(0).max(1).default(1.0),
});

export const ingredientAliasUpdateSchema = ingredientAliasCreateSchema.omit({
  ingredientId: true,
}).partial();

// ─── Unit ─────────────────────────────────────────────────────────────────────

export const unitCreateSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(60),
  pluralName: z.string().trim().min(1).max(60),
  type: z.enum(unitTypeValues),
  system: z.enum(unitSystemValues),
  symbol: z.string().trim().max(20).optional(),
  isBaseUnit: z.boolean().default(false),
  isGlobal: z.boolean().default(true),
});

export const unitUpdateSchema = unitCreateSchema.partial().omit({ code: true });

// ─── Unit Conversion ──────────────────────────────────────────────────────────

export const unitConversionCreateSchema = z.object({
  fromUnitId: z.string().trim().min(1),
  toUnitId: z.string().trim().min(1),
  ingredientId: z.string().trim().min(1).optional(),
  multiplier: z.number().positive(),
  offset: z.number().optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  notes: z.string().trim().max(300).optional(),
  isGlobal: z.boolean().default(true),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
});

export const unitConversionUpdateSchema = unitConversionCreateSchema.partial().omit({
  fromUnitId: true,
  toUnitId: true,
});

// ─── Recipe ───────────────────────────────────────────────────────────────────

export const recipeCreateSchema = z.object({
  name: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(180).optional(),
  cuisineId: z.string().trim().min(1),
  description: z.string().trim().max(1000).optional(),
  story: z.string().trim().max(2000).optional(),
  difficulty: z.enum(recipeDifficultyValues),
  spiceLevel: z.enum(spiceLevelValues),
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0),
  restMinutes: z.number().int().min(0).optional(),
  servings: z.number().int().min(1),
  servingUnit: z.string().trim().min(1).max(60).default("serving"),
  visibility: z.enum(recipeVisibilityValues).default("global"),
  sourceType: z.enum(recipeSourceTypeValues),
  organizationId: z.string().trim().min(1).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  isGlobal: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  dietaryTagIds: z.array(z.string().trim().min(1)).default([]),
});

export const recipeUpdateSchema = recipeCreateSchema.partial().omit({
  cuisineId: true,
}).extend({
  cuisineId: z.string().trim().min(1).optional(),
});

// ─── Recipe Ingredient ────────────────────────────────────────────────────────

export const recipeIngredientCreateSchema = z.object({
  recipeId: z.string().trim().min(1),
  ingredientId: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitId: z.string().trim().min(1),
  preparationNote: z.string().trim().max(200).optional(),
  section: z.string().trim().max(80).optional(),
  isOptional: z.boolean().default(false),
  displayOrder: z.number().int().min(0).default(0),
});

export const recipeIngredientUpdateSchema = recipeIngredientCreateSchema.omit({
  recipeId: true,
  ingredientId: true,
}).partial();

// ─── Recipe Step ──────────────────────────────────────────────────────────────

export const recipeStepCreateSchema = z.object({
  recipeId: z.string().trim().min(1),
  stepNumber: z.number().int().min(1),
  title: z.string().trim().max(120).optional(),
  instruction: z.string().trim().min(1).max(2000),
  durationMinutes: z.number().int().min(0).optional(),
  temperature: z.string().trim().max(30).optional(),
  tips: z.string().trim().max(500).optional(),
  displayOrder: z.number().int().min(0).default(0),
});

export const recipeStepUpdateSchema = recipeStepCreateSchema.omit({
  recipeId: true,
  stepNumber: true,
}).partial();

// ─── Media Reference ──────────────────────────────────────────────────────────

export const mediaReferenceCreateSchema = z.object({
  recipeId: z.string().trim().min(1),
  type: z.enum(mediaReferenceTypeValues),
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().url(),
  provider: z.string().trim().min(1).max(60),
  externalId: z.string().trim().max(120).optional(),
  language: z.string().trim().min(2).max(10).optional(),
  isPrimary: z.boolean().default(false),
});

export const mediaReferenceUpdateSchema = mediaReferenceCreateSchema.omit({
  recipeId: true,
}).partial();

// ─── Recipe Filters ───────────────────────────────────────────────────────────

export const recipeFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  cuisineId: z.string().trim().min(1).optional(),
  difficulty: z.enum(recipeDifficultyValues).optional(),
  spiceLevel: z.enum(spiceLevelValues).optional(),
  countryCode: z.string().trim().toUpperCase().length(2).optional(),
  isPublished: z.coerce.boolean().optional(),
  organizationId: z.string().trim().min(1).optional(),
});

export type IngredientCreateInput = z.infer<typeof ingredientCreateSchema>;
export type RecipeCreateInput = z.infer<typeof recipeCreateSchema>;
export type RecipeFilterInput = z.infer<typeof recipeFilterSchema>;
export type UnitCreateInput = z.infer<typeof unitCreateSchema>;
export type UnitConversionCreateInput = z.infer<typeof unitConversionCreateSchema>;
