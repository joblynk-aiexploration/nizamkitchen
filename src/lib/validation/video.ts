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

// ─── YouTube Discovery Admin Mutations ───────────────────────────────────────

export const youtubeDiscoveryRunSchema = z.object({
  recipeId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().min(1).optional()),
  mode: z.enum(["all", "missing"]).optional(),
  forceRefresh: z.coerce.boolean().default(false),
});

export const youtubeCandidateActionSchema = z.object({
  action: z.enum(["approve", "reject", "import"]),
  isPrimary: z.coerce.boolean().default(false),
  reason: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().trim().max(300).optional()),
});

export type YouTubeDiscoveryRunInput = z.infer<typeof youtubeDiscoveryRunSchema>;
export type YouTubeCandidateActionInput = z.infer<typeof youtubeCandidateActionSchema>;
