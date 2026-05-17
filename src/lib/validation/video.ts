import { z } from "zod";

// ─── Media Reference ──────────────────────────────────────────────────────────

export const mediaReferenceCreateSchema = z.object({
  type: z.enum(["youtube", "image", "article", "other"]),
  provider: z.enum(["youtube", "manual", "other"]).default("manual"),
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(2048),
  language: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().min(2).max(10).optional()),
  creatorName: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().min(1).max(200).optional()),
  durationSeconds: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().positive().optional(),
  ),
  isPrimary: z.coerce.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
  notes: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().max(500).optional()),
});

export const mediaReferenceUpdateSchema = mediaReferenceCreateSchema.partial();

export type MediaReferenceCreateInput = z.infer<typeof mediaReferenceCreateSchema>;
export type MediaReferenceUpdateInput = z.infer<typeof mediaReferenceUpdateSchema>;

// ─── Video Analysis Job ───────────────────────────────────────────────────────

export const videoAnalysisJobCreateSchema = z.object({
  recipeMediaReferenceId: z.string().min(1),
  recipeId: z.string().min(1),
  sourceType: z.enum(["youtube_reference", "pasted_transcript", "uploaded_video", "uploaded_audio", "manual"]),
  transcriptText: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().trim().min(10).max(100000).optional(),
  ),
  uploadedFileId: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.string().min(1).optional(),
  ),
});

export type VideoAnalysisJobCreateInput = z.infer<typeof videoAnalysisJobCreateSchema>;

// ─── AI Provider Output (strict validation before saving) ────────────────────

const aiConfidenceValues = ["exact", "high", "medium", "low", "unknown"] as const;
const aiDifferenceTypeValues = [
  "ingredient_difference",
  "quantity_difference",
  "step_difference",
  "timing_difference",
  "technique_difference",
  "spice_level_difference",
  "other",
] as const;
const aiDifferenceSeverityValues = ["info", "warning", "important"] as const;

export const aiIngredientSchema = z.object({
  ingredientName: z.string().trim().min(1).max(200),
  quantity: z.number().positive().nullable().optional(),
  unitName: z.string().trim().max(50).nullable().optional(),
  preparationNote: z.string().trim().max(300).nullable().optional(),
  timestampStartSeconds: z.number().int().min(0).nullable().optional(),
  timestampEndSeconds: z.number().int().min(0).nullable().optional(),
  confidence: z.enum(aiConfidenceValues).default("unknown"),
  evidenceText: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});

export const aiStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  title: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().min(1).max(2000),
  timestampStartSeconds: z.number().int().min(0).nullable().optional(),
  timestampEndSeconds: z.number().int().min(0).nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  temperature: z.string().trim().max(100).nullable().optional(),
  technique: z.string().trim().max(200).nullable().optional(),
  confidence: z.enum(aiConfidenceValues).default("unknown"),
  evidenceText: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});

export const aiDifferenceSchema = z.object({
  differenceType: z.enum(aiDifferenceTypeValues),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(1000),
  severity: z.enum(aiDifferenceSeverityValues).default("info"),
});

export const aiProviderOutputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2000).nullable().optional(),
  confidence: z.enum(aiConfidenceValues).default("unknown"),
  ingredients: z.array(aiIngredientSchema).max(100),
  steps: z.array(aiStepSchema).max(50),
  differencesFromWrittenRecipe: z.array(aiDifferenceSchema).max(30),
  warnings: z.array(z.string().trim().max(300)).max(20).optional(),
});

export type AIProviderOutput = z.infer<typeof aiProviderOutputSchema>;
export type AIIngredient = z.infer<typeof aiIngredientSchema>;
export type AIStep = z.infer<typeof aiStepSchema>;
export type AIDifference = z.infer<typeof aiDifferenceSchema>;

// ─── Manual Analysis ──────────────────────────────────────────────────────────

export const manualAnalysisCreateSchema = z.object({
  recipeMediaReferenceId: z.string().min(1),
  recipeId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  summary: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().max(2000).optional()),
  notes: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().max(500).optional()),
});

// ─── Verification Update ──────────────────────────────────────────────────────

export const verificationUpdateSchema = z.object({
  verificationStatus: z.enum(["needs_review", "verified", "rejected"]),
  notes: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().max(500).optional()),
});

export type VerificationUpdateInput = z.infer<typeof verificationUpdateSchema>;
