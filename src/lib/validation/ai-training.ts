import { z } from "zod";

const taskTypeValues = [
  "cooking_video_transcript_to_structured_analysis",
  "ingredient_extraction",
  "cooking_step_extraction",
  "recipe_difference_detection",
] as const;

const datasetStatusValues = ["draft", "ready", "exported", "archived"] as const;
const modelTypeValues = ["local_rules", "local_finetune_placeholder", "local_http", "external_placeholder"] as const;

export const trainingExampleUpdateSchema = z.object({
  notes: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.string().trim().max(1000).optional()),
  qualityScore: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().int().min(1).max(5).optional(),
  ),
  status: z.enum(["draft", "verified", "rejected", "exported"]).optional(),
});

export const datasetCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.string().trim().max(1000).optional()),
  taskType: z.enum(taskTypeValues).default("cooking_video_transcript_to_structured_analysis"),
});

export const datasetUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.string().trim().max(1000).optional()),
  status: z.enum(datasetStatusValues).optional(),
});

export const datasetExampleSchema = z.object({
  exampleId: z.string().min(1),
});

export const trainingRunCreateSchema = z.object({
  datasetId: z.string().min(1),
  modelType: z.enum(modelTypeValues).default("local_finetune_placeholder"),
  baseModel: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.string().trim().max(200).optional()),
  outputModelPath: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.string().trim().max(500).optional()),
  trainingConfigJson: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") return {};
    return JSON.parse(value);
  }, z.record(z.string(), z.unknown()).default({})),
});

export type DatasetCreateInput = z.infer<typeof datasetCreateSchema>;
export type DatasetUpdateInput = z.infer<typeof datasetUpdateSchema>;
export type TrainingExampleUpdateInput = z.infer<typeof trainingExampleUpdateSchema>;
export type TrainingRunCreateInput = z.infer<typeof trainingRunCreateSchema>;
