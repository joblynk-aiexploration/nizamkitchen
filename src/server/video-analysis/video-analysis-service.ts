import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { getVideoAnalysisConfig } from "@/lib/video-analysis-config";
import { normalizeAIOutput } from "./result-normalizer";
import { analyzeTranscript } from "./transcript-analyzer";
import { DisabledProvider } from "./providers/disabled-provider";
import { MockProvider } from "./providers/mock-provider";
import { OpenAIProvider } from "./providers/openai-provider";
import { AnthropicProvider } from "./providers/anthropic-provider";
import { GeminiProvider } from "./providers/gemini-provider";
import { LocalVisionProvider } from "./providers/local-vision-provider";
import { LocalRulesProvider } from "./providers/local-rules-provider";
import { LocalHttpProvider } from "./providers/local-http-provider";
import { createTrainingExampleFromVerifiedAnalysis } from "@/server/ai-training";
import type { VideoAnalysisProvider } from "./providers/types";
import type { VerificationUpdateInput } from "@/lib/validation/video";
import type { Prisma } from "@prisma/client";

function getProvider(): VideoAnalysisProvider {
  const cfg = getVideoAnalysisConfig();
  if (!cfg.enabled) return new DisabledProvider();
  switch (cfg.provider) {
    case "openai": return new OpenAIProvider();
    case "anthropic": return new AnthropicProvider();
    case "gemini": return new GeminiProvider();
    case "local_vision": return new LocalVisionProvider();
    case "local_rules": return new LocalRulesProvider();
    case "local_http": return new LocalHttpProvider();
    case "mock": return new MockProvider();
    default: return new DisabledProvider();
  }
}

const ANALYSIS_INCLUDE = {
  ingredients: { orderBy: { displayOrder: "asc" as const } },
  steps: { orderBy: { displayOrder: "asc" as const } },
  differences: true,
  analyzedBy: { select: { fullName: true } },
  verifiedBy: { select: { fullName: true } },
} as const;

export async function getVideoAnalysesForReference(recipeMediaReferenceId: string) {
  return prisma.recipeVideoAnalysis.findMany({
    where: { recipeMediaReferenceId },
    include: ANALYSIS_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getVideoAnalysisById(id: string) {
  return prisma.recipeVideoAnalysis.findUnique({
    where: { id },
    include: ANALYSIS_INCLUDE,
  });
}

export async function runTranscriptAnalysis(params: {
  jobId: string;
  recipeMediaReferenceId: string;
  recipeId: string;
  organizationId: string | null;
  countryCode: string | null;
  requestedByUserId: string;
  transcriptText: string;
}) {
  const { jobId, recipeMediaReferenceId, recipeId, organizationId, countryCode, requestedByUserId, transcriptText } = params;

  // Mark job as running
  await prisma.videoAnalysisJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });

  let providerName: string | null = null;
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        cuisine: true,
        ingredients: { include: { ingredient: true, unit: true }, orderBy: { displayOrder: "asc" } },
        steps: { orderBy: { displayOrder: "asc" } },
        mediaRefs: { where: { id: recipeMediaReferenceId } },
      },
    });

    if (!recipe) throw new Error(`Recipe ${recipeId} not found.`);

    const mediaRef = recipe.mediaRefs[0];
    const provider = getProvider();
    providerName = provider.name;
    if (provider.name === "local_rules" || provider.name === "local_http") {
      await createAuditEvent({
        actorUserId: requestedByUserId,
        organizationId,
        countryCode,
        action: "local_ai.analysis_started",
        targetType: "video_analysis_job",
        targetId: jobId,
        details: { provider: provider.name } as Prisma.InputJsonValue,
      });
    }

    const result = await analyzeTranscript(provider, {
      recipeId,
      recipeTitle: recipe.name,
      recipeCuisine: recipe.cuisine.name,
      recipeCountryCode: recipe.countryCode,
      recipeIngredients: recipe.ingredients.map((ri) => ({
        name: ri.ingredient.name,
        quantity: ri.quantity,
        unit: ri.unit.name,
      })),
      recipeStepCount: recipe.steps.length,
      transcriptText,
      videoTitle: mediaRef?.title ?? null,
      videoLanguage: mediaRef?.language ?? null,
    });

    if (!result.success) {
      await prisma.videoAnalysisJob.update({
        where: { id: jobId },
        data: { status: "failed", errorMessage: result.error, completedAt: new Date() },
      });
      await createAuditEvent({
        actorUserId: requestedByUserId,
        organizationId,
        countryCode,
        action: "video_analysis_job.failed",
        targetType: "video_analysis_job",
        targetId: jobId,
        details: { error: result.error } as Prisma.InputJsonValue,
      });
      if (provider.name === "local_rules" || provider.name === "local_http") {
        await createAuditEvent({
          actorUserId: requestedByUserId,
          organizationId,
          countryCode,
          action: "local_ai.analysis_failed",
          targetType: "video_analysis_job",
          targetId: jobId,
          details: { provider: provider.name, error: result.error } as Prisma.InputJsonValue,
        });
      }
      return { success: false as const, error: result.error };
    }

    // Validate and normalize AI output — throws if invalid
    const normalized = await normalizeAIOutput(result.output);

    const analysis = await prisma.$transaction(async (tx) => {
      const created = await tx.recipeVideoAnalysis.create({
        data: {
          recipeMediaReferenceId,
          recipeId,
          organizationId,
          countryCode,
          title: normalized.title,
          summary: normalized.summary,
          analysisSource: "transcript_ai",
          aiProvider: result.provider,
          aiModel: result.model,
          promptVersion: "v1",
          verificationStatus: "ai_draft",
          confidence: normalized.confidence,
          analyzedByUserId: requestedByUserId,
          rawTranscriptProvided: true,
          ingredients: {
            create: normalized.ingredients.map((ing) => ({
              ingredientId: ing.ingredientId,
              ingredientName: ing.ingredientName,
              normalizedIngredientName: ing.normalizedIngredientName,
              quantity: ing.quantity,
              unitId: ing.unitId,
              unitName: ing.unitName,
              preparationNote: ing.preparationNote,
              timestampStartSeconds: ing.timestampStartSeconds,
              timestampEndSeconds: ing.timestampEndSeconds,
              confidence: ing.confidence,
              evidenceText: ing.evidenceText,
              evidenceFrameTimestamp: ing.evidenceFrameTimestamp,
              notes: ing.notes,
              displayOrder: ing.displayOrder,
            })),
          },
          steps: {
            create: normalized.steps.map((step) => ({
              stepNumber: step.stepNumber,
              title: step.title,
              description: step.description,
              timestampStartSeconds: step.timestampStartSeconds,
              timestampEndSeconds: step.timestampEndSeconds,
              durationSeconds: step.durationSeconds,
              temperature: step.temperature,
              technique: step.technique,
              confidence: step.confidence,
              evidenceText: step.evidenceText,
              evidenceFrameTimestamp: step.evidenceFrameTimestamp,
              notes: step.notes,
              displayOrder: step.displayOrder,
            })),
          },
          differences: {
            create: normalized.differences.map((d) => ({
              differenceType: d.differenceType as Parameters<typeof tx.videoRecipeDifference.create>[0]["data"]["differenceType"],
              title: d.title,
              description: d.description,
              severity: d.severity as Parameters<typeof tx.videoRecipeDifference.create>[0]["data"]["severity"],
            })),
          },
        },
      });
      await tx.videoAnalysisJob.update({
        where: { id: jobId },
        data: { status: "completed", completedAt: new Date() },
      });
      return created;
    });

    await createAuditEvent({
      actorUserId: requestedByUserId,
      organizationId,
      countryCode,
      action: "recipe_video_analysis.created",
      targetType: "recipe_video_analysis",
      targetId: analysis.id,
      details: {
        recipeMediaReferenceId,
        recipeId,
        provider: result.provider,
        ingredientCount: normalized.ingredients.length,
        stepCount: normalized.steps.length,
      } as Prisma.InputJsonValue,
    });
    await createAuditEvent({
      actorUserId: requestedByUserId,
      organizationId,
      countryCode,
      action: "video_analysis_job.completed",
      targetType: "video_analysis_job",
      targetId: jobId,
    });
    if (result.provider === "local_rules" || result.provider === "local_http") {
      await createAuditEvent({
        actorUserId: requestedByUserId,
        organizationId,
        countryCode,
        action: "local_ai.analysis_completed",
        targetType: "recipe_video_analysis",
        targetId: analysis.id,
        details: { provider: result.provider, model: result.model } as Prisma.InputJsonValue,
      });
    }

    return { success: true as const, analysisId: analysis.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await prisma.videoAnalysisJob.update({
      where: { id: jobId },
      data: { status: "failed", errorMessage: msg, completedAt: new Date() },
    }).catch(() => undefined);
    await createAuditEvent({
      actorUserId: requestedByUserId,
      organizationId,
      countryCode,
      action: "video_analysis_job.failed",
      targetType: "video_analysis_job",
      targetId: jobId,
      details: { error: msg } as Prisma.InputJsonValue,
    });
    if (providerName === "local_rules" || providerName === "local_http") {
      await createAuditEvent({
        actorUserId: requestedByUserId,
        organizationId,
        countryCode,
        action: "local_ai.analysis_failed",
        targetType: "video_analysis_job",
        targetId: jobId,
        details: { provider: providerName, error: msg } as Prisma.InputJsonValue,
      });
    }
    return { success: false as const, error: msg };
  }
}

export async function updateVerificationStatus(params: {
  analysisId: string;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
  input: VerificationUpdateInput;
}) {
  const { analysisId, actorUserId, organizationId, countryCode, input } = params;

  const updated = await prisma.recipeVideoAnalysis.update({
    where: { id: analysisId },
    data: {
      verificationStatus: input.verificationStatus,
      verifiedByUserId: input.verificationStatus === "verified" ? actorUserId : undefined,
      verifiedAt: input.verificationStatus === "verified" ? new Date() : undefined,
      notes: input.notes ?? undefined,
    },
  });

  const action = input.verificationStatus === "verified"
    ? "recipe_video_analysis.verified"
    : input.verificationStatus === "rejected"
      ? "recipe_video_analysis.rejected"
      : "recipe_video_analysis.updated";

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action,
    targetType: "recipe_video_analysis",
    targetId: analysisId,
    details: { verificationStatus: input.verificationStatus, notes: input.notes } as Prisma.InputJsonValue,
  });

  if (input.verificationStatus === "verified") {
    await createTrainingExampleFromVerifiedAnalysis({
      analysisId,
      actorUserId,
    });
  }

  return updated;
}
