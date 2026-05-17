import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { getYouTubeDiscoveryConfig } from "@/lib/youtube-discovery-config";
import { verifyVideoAvailability } from "@/lib/youtube-api";
import type { VideoAvailabilityStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type AvailabilityCheckResult = {
  id: string;
  videoId: string;
  status: VideoAvailabilityStatus;
  reason: string | null;
};

// Check and update a single RecipeMediaReference
export async function recheckMediaReferenceAvailability(params: {
  mediaReferenceId: string;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
}): Promise<AvailabilityCheckResult> {
  const { mediaReferenceId, actorUserId, organizationId, countryCode } = params;

  const ref = await prisma.recipeMediaReference.findUnique({ where: { id: mediaReferenceId } });
  if (!ref) throw new Error("Media reference not found.");
  if (!ref.externalId) throw new Error("Media reference has no video ID.");

  const cfg = getYouTubeDiscoveryConfig();
  if (!cfg.enabled) {
    // Without API key, mark as unknown rather than crash
    await prisma.recipeMediaReference.update({
      where: { id: mediaReferenceId },
      data: { availabilityStatus: "unknown", lastAvailabilityCheckedAt: new Date() },
    });
    return { id: mediaReferenceId, videoId: ref.externalId, status: "unknown", reason: cfg.reason };
  }

  const result = await verifyVideoAvailability({ videoId: ref.externalId, apiKey: cfg.apiKey });
  const now = new Date();

  if (result.available) {
    await prisma.recipeMediaReference.update({
      where: { id: mediaReferenceId },
      data: {
        availabilityStatus: "available",
        lastAvailabilityCheckedAt: now,
        unavailableReason: null,
        isEmbeddable: result.isEmbeddable,
        isPublic: result.isPublic,
        uploadStatus: result.uploadStatus,
        liveBroadcastContent: result.liveBroadcastContent,
        qualityDefinition: result.qualityDefinition,
      },
    });
    await createAuditEvent({
      actorUserId,
      organizationId,
      countryCode,
      action: "youtube_video.availability_checked",
      targetType: "recipe_media_reference",
      targetId: mediaReferenceId,
      details: { videoId: ref.externalId, status: "available" } as Prisma.InputJsonValue,
    });
    return { id: mediaReferenceId, videoId: ref.externalId, status: "available", reason: null };
  } else {
    const wasAvailable = ref.availabilityStatus === "available";
    await prisma.recipeMediaReference.update({
      where: { id: mediaReferenceId },
      data: {
        availabilityStatus: "unavailable",
        lastAvailabilityCheckedAt: now,
        unavailableReason: result.reason,
        isEmbeddable: result.isEmbeddable,
        isPublic: result.isPublic,
        uploadStatus: result.uploadStatus ?? null,
        liveBroadcastContent: result.liveBroadcastContent ?? null,
        qualityDefinition: result.qualityDefinition ?? null,
      },
    });
    const auditAction = wasAvailable
      ? "youtube_video.marked_unavailable"
      : "youtube_video.availability_checked";
    await createAuditEvent({
      actorUserId,
      organizationId,
      countryCode,
      action: auditAction,
      targetType: "recipe_media_reference",
      targetId: mediaReferenceId,
      details: { videoId: ref.externalId, status: "unavailable", reason: result.reason } as Prisma.InputJsonValue,
    });
    return { id: mediaReferenceId, videoId: ref.externalId, status: "unavailable", reason: result.reason };
  }
}

// Check and update a single YouTubeVideoCandidate
export async function recheckCandidateAvailability(params: {
  candidateId: string;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
}): Promise<AvailabilityCheckResult> {
  const { candidateId, actorUserId, organizationId, countryCode } = params;

  const candidate = await prisma.youTubeVideoCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error("Candidate not found.");

  const cfg = getYouTubeDiscoveryConfig();
  if (!cfg.enabled) {
    await prisma.youTubeVideoCandidate.update({
      where: { id: candidateId },
      data: { availabilityStatus: "unknown", lastAvailabilityCheckedAt: new Date() },
    });
    return { id: candidateId, videoId: candidate.providerVideoId, status: "unknown", reason: cfg.reason };
  }

  const result = await verifyVideoAvailability({ videoId: candidate.providerVideoId, apiKey: cfg.apiKey });
  const now = new Date();

  if (result.available) {
    await prisma.youTubeVideoCandidate.update({
      where: { id: candidateId },
      data: {
        availabilityStatus: "available",
        lastAvailabilityCheckedAt: now,
        unavailableReason: null,
        isEmbeddable: result.isEmbeddable,
        isPublic: result.isPublic,
        uploadStatus: result.uploadStatus,
        liveBroadcastContent: result.liveBroadcastContent,
        qualityDefinition: result.qualityDefinition,
      },
    });
    return { id: candidateId, videoId: candidate.providerVideoId, status: "available", reason: null };
  } else {
    await prisma.youTubeVideoCandidate.update({
      where: { id: candidateId },
      data: {
        availabilityStatus: "unavailable",
        lastAvailabilityCheckedAt: now,
        unavailableReason: result.reason,
        isEmbeddable: result.isEmbeddable,
        isPublic: result.isPublic,
        uploadStatus: result.uploadStatus ?? null,
        liveBroadcastContent: result.liveBroadcastContent ?? null,
        qualityDefinition: result.qualityDefinition ?? null,
        // Auto-reject unavailable candidates
        status: candidate.status === "pending" ? "rejected" : candidate.status,
        rejectionReasonsJson: [
          ...((candidate.rejectionReasonsJson as string[] | null) ?? []),
          `Availability check failed: ${result.reason}`,
        ] as Prisma.InputJsonValue,
      },
    });
    await createAuditEvent({
      actorUserId,
      organizationId,
      countryCode,
      action: "youtube_candidate.rejected_unavailable",
      targetType: "youtube_video_candidate",
      targetId: candidateId,
      details: { videoId: candidate.providerVideoId, reason: result.reason } as Prisma.InputJsonValue,
    });
    return { id: candidateId, videoId: candidate.providerVideoId, status: "unavailable", reason: result.reason };
  }
}

// Bulk recheck all media references for a recipe or all recipes
export async function recheckAllMediaReferences(params: {
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
  recipeId?: string;
}): Promise<{ checked: number; unavailable: number; errors: string[] }> {
  const { actorUserId, organizationId, countryCode, recipeId } = params;

  const refs = await prisma.recipeMediaReference.findMany({
    where: {
      type: "youtube",
      externalId: { not: null },
      ...(recipeId ? { recipeId } : {}),
    },
    select: { id: true, externalId: true },
  });

  let unavailable = 0;
  const errors: string[] = [];

  for (const ref of refs) {
    try {
      const result = await recheckMediaReferenceAvailability({
        mediaReferenceId: ref.id,
        actorUserId,
        organizationId,
        countryCode,
      });
      if (result.status === "unavailable") unavailable++;
    } catch (e) {
      errors.push(`${ref.externalId}: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  return { checked: refs.length, unavailable, errors };
}
