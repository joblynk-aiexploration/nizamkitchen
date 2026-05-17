import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import type { VideoAnalysisJobCreateInput } from "@/lib/validation/video";
import type { Prisma } from "@prisma/client";

export async function createAnalysisJob(params: {
  input: VideoAnalysisJobCreateInput;
  requestedByUserId: string;
  organizationId: string | null;
  countryCode: string | null;
}) {
  const { input, requestedByUserId, organizationId, countryCode } = params;

  const job = await prisma.videoAnalysisJob.create({
    data: {
      recipeMediaReferenceId: input.recipeMediaReferenceId,
      recipeId: input.recipeId,
      organizationId,
      requestedByUserId,
      status: "queued",
      sourceType: input.sourceType,
      transcriptText: input.transcriptText ?? null,
      uploadedFileId: input.uploadedFileId ?? null,
    },
  });

  await createAuditEvent({
    actorUserId: requestedByUserId,
    organizationId,
    countryCode,
    action: "video_analysis_job.created",
    targetType: "video_analysis_job",
    targetId: job.id,
    details: {
      recipeMediaReferenceId: input.recipeMediaReferenceId,
      recipeId: input.recipeId,
      sourceType: input.sourceType,
    } as Prisma.InputJsonValue,
  });

  return job;
}

export async function getAnalysisJob(jobId: string) {
  return prisma.videoAnalysisJob.findUnique({ where: { id: jobId } });
}

export async function listAnalysisJobsForReference(recipeMediaReferenceId: string) {
  return prisma.videoAnalysisJob.findMany({
    where: { recipeMediaReferenceId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
