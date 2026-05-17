import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, createAuditEvent } = vi.hoisted(() => ({
  mockPrisma: {
    recipeVideoAnalysis: { findUnique: vi.fn() },
    videoAnalysisJob: { findFirst: vi.fn() },
    aiTrainingExample: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    aiTrainingDataset: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    aiTrainingDatasetExample: { upsert: vi.fn() },
    aiTrainingRun: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  createAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent }));

import {
  addVerifiedExamplesToDataset,
  createTrainingDataset,
  createTrainingExampleFromVerifiedAnalysis,
  exportDatasetAsJsonl,
} from "@/server/ai-training";

const verifiedAnalysis = {
  id: "analysis-1",
  verificationStatus: "verified",
  organizationId: "org-1",
  countryCode: "US",
  recipeId: "recipe-1",
  recipeMediaReferenceId: "media-1",
  title: "Verified analysis",
  summary: "Good transcript analysis.",
  confidence: "medium",
  promptVersion: "v1",
  aiProvider: "local_rules",
  recipe: {
    name: "Bagara Khana",
    countryCode: "US",
    cuisine: { name: "Hyderabadi" },
    ingredients: [{ ingredient: { name: "Basmati Rice" }, quantity: 2, unit: { name: "cups" }, preparationNote: null }],
  },
  mediaReference: {
    title: "Bagara Khana video",
    provider: "youtube",
    externalId: "abc123",
    creatorName: "Kitchen Channel",
    durationSeconds: 600,
    language: "en",
    thumbnailUrl: null,
  },
  ingredients: [{ ingredientName: "Basmati rice", quantity: 2, unitName: "cups", preparationNote: null, timestampStartSeconds: 0, timestampEndSeconds: null, confidence: "high", evidenceText: "2 cups rice", notes: null }],
  steps: [{ stepNumber: 1, title: "Wash", description: "Wash rice", timestampStartSeconds: 0, timestampEndSeconds: null, durationSeconds: null, technique: "soaking", confidence: "high", evidenceText: "Wash rice", notes: null }],
  differences: [],
};

describe("AI training foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a verified training example from verified video analysis", async () => {
    mockPrisma.recipeVideoAnalysis.findUnique.mockResolvedValue(verifiedAnalysis);
    mockPrisma.aiTrainingExample.findUnique.mockResolvedValue(null);
    mockPrisma.videoAnalysisJob.findFirst.mockResolvedValue({ transcriptText: "0:00 Add 2 cups rice." });
    mockPrisma.aiTrainingExample.create.mockResolvedValue({ id: "example-1", sourceType: "video_analysis", taskType: "cooking_video_transcript_to_structured_analysis" });

    const example = await createTrainingExampleFromVerifiedAnalysis({ analysisId: "analysis-1", actorUserId: "admin-1" });

    expect(example?.id).toBe("example-1");
    expect(mockPrisma.aiTrainingExample.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "verified",
          recipeVideoAnalysisId: "analysis-1",
          inputJson: expect.objectContaining({ transcript: "0:00 Add 2 cups rice." }),
        }),
      }),
    );
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ai_training_example.created_from_verified_analysis" }));
  });

  it("does not duplicate training examples for repeated verification", async () => {
    mockPrisma.recipeVideoAnalysis.findUnique.mockResolvedValue(verifiedAnalysis);
    mockPrisma.aiTrainingExample.findUnique.mockResolvedValue({ id: "example-existing" });

    const example = await createTrainingExampleFromVerifiedAnalysis({ analysisId: "analysis-1", actorUserId: "admin-1" });

    expect(example?.id).toBe("example-existing");
    expect(mockPrisma.aiTrainingExample.create).not.toHaveBeenCalled();
  });

  it("does not create verified training examples for rejected analysis", async () => {
    mockPrisma.recipeVideoAnalysis.findUnique.mockResolvedValue({ ...verifiedAnalysis, verificationStatus: "rejected" });

    const example = await createTrainingExampleFromVerifiedAnalysis({ analysisId: "analysis-1", actorUserId: "admin-1" });

    expect(example).toBeNull();
    expect(mockPrisma.aiTrainingExample.create).not.toHaveBeenCalled();
  });

  it("creates datasets for verified examples", async () => {
    mockPrisma.aiTrainingDataset.create.mockResolvedValue({ id: "dataset-1", taskType: "ingredient_extraction" });

    await createTrainingDataset({
      actorUserId: "admin-1",
      input: { name: "Ingredient extraction v1", taskType: "ingredient_extraction" },
    });

    expect(mockPrisma.aiTrainingDataset.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Ingredient extraction v1" }) }),
    );
  });

  it("adds only verified matching examples to a dataset", async () => {
    mockPrisma.aiTrainingDataset.findUniqueOrThrow.mockResolvedValue({
      id: "dataset-1",
      taskType: "ingredient_extraction",
    });
    mockPrisma.aiTrainingExample.findMany.mockResolvedValue([{ id: "example-1" }]);
    mockPrisma.aiTrainingDatasetExample.upsert.mockReturnValue({ kind: "upsert" });
    mockPrisma.aiTrainingDataset.update.mockReturnValue({ kind: "update" });
    mockPrisma.$transaction.mockResolvedValue([]);

    await addVerifiedExamplesToDataset({ datasetId: "dataset-1", actorUserId: "admin-1" });

    expect(mockPrisma.aiTrainingExample.findMany).toHaveBeenCalledWith({
      where: { status: "verified", taskType: "ingredient_extraction" },
      select: { id: true },
    });
  });

  it("exports JSONL with only verified examples and no secrets", async () => {
    mockPrisma.aiTrainingDataset.findUnique.mockResolvedValue({
      id: "dataset-1",
      examples: [
        {
          example: {
            id: "example-1",
            status: "verified",
            taskType: "cooking_video_transcript_to_structured_analysis",
            sourceType: "video_analysis",
            inputJson: { recipeName: "Test", transcript: "authorized transcript", secret: "api_key=abc" },
            expectedOutputJson: { ingredients: [] },
            verifiedAt: new Date("2026-05-17T00:00:00.000Z"),
            qualityScore: 5,
          },
        },
        {
          example: {
            id: "example-2",
            status: "rejected",
            taskType: "ingredient_extraction",
            sourceType: "manual",
            inputJson: {},
            expectedOutputJson: {},
            verifiedAt: null,
            qualityScore: null,
          },
        },
      ],
    });
    mockPrisma.aiTrainingDataset.update.mockResolvedValue({});
    mockPrisma.aiTrainingExample.updateMany.mockResolvedValue({});

    const jsonl = await exportDatasetAsJsonl({ datasetId: "dataset-1", actorUserId: "admin-1" });
    const lines = jsonl.trim().split("\n");
    expect(lines).toHaveLength(1);
    const exported = JSON.parse(lines[0]);
    expect(exported.input.recipeName).toBe("Test");
    expect(JSON.stringify(exported)).not.toContain("api_key=abc");
  });
});
