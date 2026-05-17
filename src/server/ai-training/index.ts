import { Prisma, type AiTrainingTaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import {
  datasetCreateSchema,
  datasetUpdateSchema,
  trainingExampleUpdateSchema,
  trainingRunCreateSchema,
} from "@/lib/validation/ai-training";

const DEFAULT_TASK: AiTrainingTaskType = "cooking_video_transcript_to_structured_analysis";

export async function getAiTrainingDashboardData() {
  const [
    total,
    verified,
    draft,
    rejected,
    datasets,
    exportedDatasets,
    recentExamples,
  ] = await Promise.all([
    prisma.aiTrainingExample.count(),
    prisma.aiTrainingExample.count({ where: { status: "verified" } }),
    prisma.aiTrainingExample.count({ where: { status: "draft" } }),
    prisma.aiTrainingExample.count({ where: { status: "rejected" } }),
    prisma.aiTrainingDataset.count(),
    prisma.aiTrainingDataset.count({ where: { status: "exported" } }),
    prisma.aiTrainingExample.findMany({
      where: { status: "verified" },
      include: { recipe: { select: { name: true } }, verifiedBy: { select: { fullName: true } } },
      orderBy: { verifiedAt: "desc" },
      take: 8,
    }),
  ]);

  return { total, verified, draft, rejected, datasets, exportedDatasets, recentExamples };
}

export async function listTrainingExamples(filters?: {
  status?: string;
  taskType?: string;
  countryCode?: string;
  sourceType?: string;
  search?: string;
}) {
  return prisma.aiTrainingExample.findMany({
    where: {
      status: filters?.status ? filters.status as never : undefined,
      taskType: filters?.taskType ? filters.taskType as never : undefined,
      countryCode: filters?.countryCode || undefined,
      sourceType: filters?.sourceType ? filters.sourceType as never : undefined,
      recipe: filters?.search ? { name: { contains: filters.search, mode: "insensitive" } } : undefined,
    },
    include: {
      recipe: { select: { id: true, name: true, countryCode: true } },
      recipeMediaReference: { select: { id: true, title: true, externalId: true } },
      verifiedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getTrainingExample(id: string) {
  return prisma.aiTrainingExample.findUnique({
    where: { id },
    include: {
      recipe: { select: { id: true, name: true, countryCode: true } },
      recipeMediaReference: { select: { id: true, title: true, externalId: true, normalizedUrl: true } },
      recipeVideoAnalysis: { select: { id: true, aiProvider: true, aiModel: true, verificationStatus: true } },
      createdBy: { select: { fullName: true } },
      verifiedBy: { select: { fullName: true } },
    },
  });
}

export async function updateTrainingExample(params: {
  exampleId: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = trainingExampleUpdateSchema.parse(params.input);
  const example = await prisma.aiTrainingExample.update({
    where: { id: params.exampleId },
    data: {
      notes: parsed.notes,
      qualityScore: parsed.qualityScore,
      status: parsed.status,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: example.organizationId,
    countryCode: example.countryCode,
    action: parsed.status === "rejected" ? "ai_training_example.rejected" : "ai_training_example.updated",
    targetType: "ai_training_example",
    targetId: example.id,
    details: { status: example.status, qualityScore: example.qualityScore } as Prisma.InputJsonValue,
  });

  return example;
}

export async function createTrainingExampleFromVerifiedAnalysis(params: {
  analysisId: string;
  actorUserId: string;
}) {
  const analysis = await prisma.recipeVideoAnalysis.findUnique({
    where: { id: params.analysisId },
    include: {
      recipe: {
        include: {
          cuisine: true,
          ingredients: { include: { ingredient: true, unit: true }, orderBy: { displayOrder: "asc" } },
        },
      },
      mediaReference: true,
      ingredients: { orderBy: { displayOrder: "asc" } },
      steps: { orderBy: { displayOrder: "asc" } },
      differences: true,
    },
  });
  if (!analysis || analysis.verificationStatus !== "verified") return null;

  const existing = await prisma.aiTrainingExample.findUnique({
    where: { recipeVideoAnalysisId: analysis.id },
  });
  if (existing) return existing;

  const sourceJob = await prisma.videoAnalysisJob.findFirst({
    where: {
      recipeMediaReferenceId: analysis.recipeMediaReferenceId,
      recipeId: analysis.recipeId,
      transcriptText: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  const inputJson = {
    recipeName: analysis.recipe.name,
    cuisine: analysis.recipe.cuisine.name,
    countryCode: analysis.countryCode ?? analysis.recipe.countryCode,
    writtenIngredients: analysis.recipe.ingredients.map((item) => ({
      name: item.ingredient.name,
      quantity: item.quantity,
      unit: item.unit.name,
      preparationNote: item.preparationNote,
    })),
    mediaReference: {
      title: analysis.mediaReference.title,
      provider: analysis.mediaReference.provider,
      externalId: analysis.mediaReference.externalId,
      creatorName: analysis.mediaReference.creatorName,
      durationSeconds: analysis.mediaReference.durationSeconds,
    },
    transcript: sourceJob?.transcriptText ?? null,
    transcriptPolicy: sourceJob?.transcriptText ? "user_provided_or_admin_provided" : "not_available",
    videoMetadata: {
      title: analysis.mediaReference.title,
      language: analysis.mediaReference.language,
      thumbnailUrl: analysis.mediaReference.thumbnailUrl,
    },
    promptVersion: analysis.promptVersion,
  };

  const expectedOutputJson = {
    title: analysis.title,
    summary: analysis.summary,
    confidence: analysis.confidence,
    ingredients: analysis.ingredients.map((ingredient) => ({
      ingredientName: ingredient.ingredientName,
      quantity: ingredient.quantity,
      unitName: ingredient.unitName,
      preparationNote: ingredient.preparationNote,
      timestampStartSeconds: ingredient.timestampStartSeconds,
      timestampEndSeconds: ingredient.timestampEndSeconds,
      confidence: ingredient.confidence,
      evidenceText: ingredient.evidenceText,
      notes: ingredient.notes,
    })),
    steps: analysis.steps.map((step) => ({
      stepNumber: step.stepNumber,
      title: step.title,
      description: step.description,
      timestampStartSeconds: step.timestampStartSeconds,
      timestampEndSeconds: step.timestampEndSeconds,
      durationSeconds: step.durationSeconds,
      technique: step.technique,
      confidence: step.confidence,
      evidenceText: step.evidenceText,
      notes: step.notes,
    })),
    differences: analysis.differences.map((difference) => ({
      differenceType: difference.differenceType,
      title: difference.title,
      description: difference.description,
      severity: difference.severity,
    })),
    warnings: [],
  };

  const example = await prisma.aiTrainingExample.create({
    data: {
      organizationId: analysis.organizationId,
      countryCode: analysis.countryCode,
      recipeId: analysis.recipeId,
      recipeMediaReferenceId: analysis.recipeMediaReferenceId,
      recipeVideoAnalysisId: analysis.id,
      createdByUserId: params.actorUserId,
      verifiedByUserId: params.actorUserId,
      status: "verified",
      sourceType: analysis.aiProvider === "mock" ? "ai_draft_corrected" : "video_analysis",
      taskType: DEFAULT_TASK,
      inputJson,
      expectedOutputJson,
      verifiedAt: new Date(),
      notes: analysis.aiProvider === "mock" ? "Mock source requires manual correction review before export." : null,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: analysis.organizationId,
    countryCode: analysis.countryCode,
    action: "ai_training_example.created",
    targetType: "ai_training_example",
    targetId: example.id,
    details: { sourceType: example.sourceType, taskType: example.taskType } as Prisma.InputJsonValue,
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    organizationId: analysis.organizationId,
    countryCode: analysis.countryCode,
    action: "ai_training_example.created_from_verified_analysis",
    targetType: "ai_training_example",
    targetId: example.id,
    details: { analysisId: analysis.id, aiProvider: analysis.aiProvider } as Prisma.InputJsonValue,
  });

  return example;
}

export async function listTrainingDatasets() {
  return prisma.aiTrainingDataset.findMany({
    include: { createdBy: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTrainingDataset(id: string) {
  return prisma.aiTrainingDataset.findUnique({
    where: { id },
    include: {
      examples: {
        include: { example: { include: { recipe: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: "desc" },
      },
      runs: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createTrainingDataset(params: {
  actorUserId: string;
  input: unknown;
}) {
  const parsed = datasetCreateSchema.parse(params.input);
  const dataset = await prisma.aiTrainingDataset.create({
    data: {
      name: parsed.name,
      description: parsed.description,
      taskType: parsed.taskType,
      createdByUserId: params.actorUserId,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    action: "ai_training_dataset.created",
    targetType: "ai_training_dataset",
    targetId: dataset.id,
    details: { taskType: dataset.taskType } as Prisma.InputJsonValue,
  });

  return dataset;
}

export async function updateTrainingDataset(params: {
  datasetId: string;
  actorUserId: string;
  input: unknown;
}) {
  const parsed = datasetUpdateSchema.parse(params.input);
  const dataset = await prisma.aiTrainingDataset.update({
    where: { id: params.datasetId },
    data: parsed,
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    action: "ai_training_dataset.updated",
    targetType: "ai_training_dataset",
    targetId: dataset.id,
    details: { status: dataset.status } as Prisma.InputJsonValue,
  });

  return dataset;
}

export async function addVerifiedExamplesToDataset(params: {
  datasetId: string;
  actorUserId: string;
}) {
  const dataset = await prisma.aiTrainingDataset.findUniqueOrThrow({ where: { id: params.datasetId } });
  const examples = await prisma.aiTrainingExample.findMany({
    where: { status: "verified", taskType: dataset.taskType },
    select: { id: true },
  });

  await prisma.$transaction([
    ...examples.map((example) => prisma.aiTrainingDatasetExample.upsert({
      where: { datasetId_exampleId: { datasetId: dataset.id, exampleId: example.id } },
      update: {},
      create: { datasetId: dataset.id, exampleId: example.id },
    })),
    prisma.aiTrainingDataset.update({
      where: { id: dataset.id },
      data: { exampleCount: examples.length },
    }),
  ]);

  await createAuditEvent({
    actorUserId: params.actorUserId,
    action: "ai_training_dataset.updated",
    targetType: "ai_training_dataset",
    targetId: dataset.id,
    details: { addedVerifiedExamples: examples.length } as Prisma.InputJsonValue,
  });
}

export async function createTrainingRun(params: {
  actorUserId: string;
  input: unknown;
}) {
  const parsed = trainingRunCreateSchema.parse(params.input);
  const run = await prisma.aiTrainingRun.create({
    data: {
      datasetId: parsed.datasetId,
      modelType: parsed.modelType,
      baseModel: parsed.baseModel,
      outputModelPath: parsed.outputModelPath,
      trainingConfigJson: parsed.trainingConfigJson as Prisma.InputJsonValue,
    },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    action: "ai_training_run.created",
    targetType: "ai_training_run",
    targetId: run.id,
    details: { modelType: run.modelType, datasetId: run.datasetId } as Prisma.InputJsonValue,
  });

  return run;
}

export async function exportDatasetAsJsonl(params: {
  datasetId: string;
  actorUserId: string;
}) {
  const dataset = await prisma.aiTrainingDataset.findUnique({
    where: { id: params.datasetId },
    include: {
      examples: {
        include: { example: true },
      },
    },
  });
  if (!dataset) throw new Error("Dataset not found.");

  const verifiedExamples = dataset.examples
    .map((item) => item.example)
    .filter((example) => example.status === "verified");

  const lines = verifiedExamples.map((example) => JSON.stringify({
    task: example.taskType,
    input: sanitizeTrainingJson(example.inputJson),
    output: sanitizeTrainingJson(example.expectedOutputJson),
    metadata: {
      source: example.sourceType,
      verifiedAt: example.verifiedAt?.toISOString() ?? null,
      qualityScore: example.qualityScore,
      transcriptPermissionWarning: hasTranscript(example.inputJson)
        ? "Export includes transcript text only when user/admin provided or permission is documented."
        : null,
    },
  }));

  await prisma.aiTrainingDataset.update({
    where: { id: dataset.id },
    data: { status: "exported", exampleCount: verifiedExamples.length },
  });

  await prisma.aiTrainingExample.updateMany({
    where: { id: { in: verifiedExamples.map((example) => example.id) } },
    data: { status: "exported" },
  });

  await createAuditEvent({
    actorUserId: params.actorUserId,
    action: "ai_training_dataset.exported",
    targetType: "ai_training_dataset",
    targetId: dataset.id,
    details: { exampleCount: verifiedExamples.length } as Prisma.InputJsonValue,
  });

  return lines.join("\n") + (lines.length ? "\n" : "");
}

function sanitizeTrainingJson(value: Prisma.JsonValue) {
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === "string" && /api[_-]?key|secret|token/i.test(item)) return "[redacted]";
    return item;
  })) as unknown;
}

function hasTranscript(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return typeof (value as Record<string, unknown>).transcript === "string" && Boolean((value as Record<string, unknown>).transcript);
}
