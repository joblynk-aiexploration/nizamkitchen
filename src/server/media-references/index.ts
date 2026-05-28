import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { parseYouTubeUrl } from "@/lib/youtube";
import { isSafeUrl } from "@/lib/media-url";
import { getYouTubeDiscoveryConfig } from "@/lib/youtube-discovery-config";
import { verifyVideoAvailability } from "@/lib/youtube-api";
import type { MediaReferenceCreateInput } from "@/lib/validation/video";
import type { Prisma } from "@prisma/client";

export async function listMediaReferencesForRecipe(recipeId: string) {
  return prisma.recipeMediaReference.findMany({
    where: { recipeId },
    orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
  });
}

export async function getMediaReferenceById(id: string) {
  return prisma.recipeMediaReference.findUnique({ where: { id } });
}

export async function createMediaReference(params: {
  recipeId: string;
  input: MediaReferenceCreateInput;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
}) {
  const { recipeId, input, actorUserId, organizationId, countryCode } = params;

  if (!isSafeUrl(input.url)) {
    throw new Error("Invalid or unsafe URL provided.");
  }

  let normalizedUrl: string | null = null;
  let embedUrl: string | null = null;
  let externalId: string | null = null;

  if (input.type === "youtube" || input.provider === "youtube") {
    const parsed = parseYouTubeUrl(input.url);
    if (!parsed) throw new Error("Invalid YouTube URL. Provide a watch, short, or embed URL.");
    normalizedUrl = parsed.normalizedUrl;
    embedUrl = parsed.embedUrl;
    externalId = parsed.externalId;
  }

  // Verify YouTube availability if API key is configured.
  // Without a key: save as unchecked — do not mark available without verification.
  let availabilityFields: {
    availabilityStatus: "available" | "unavailable" | "unchecked";
    lastAvailabilityCheckedAt: Date | null;
    isEmbeddable: boolean;
    isPublic: boolean;
    uploadStatus: string | null;
    liveBroadcastContent: string | null;
    qualityDefinition: string | null;
    unavailableReason: string | null;
  } = {
    availabilityStatus: "unchecked",
    lastAvailabilityCheckedAt: null,
    isEmbeddable: false,
    isPublic: false,
    uploadStatus: null,
    liveBroadcastContent: null,
    qualityDefinition: null,
    unavailableReason: null,
  };

  if (externalId && (input.type === "youtube" || input.provider === "youtube")) {
    const cfg = await getYouTubeDiscoveryConfig();
    if (cfg.enabled) {
      const check = await verifyVideoAvailability({ videoId: externalId, apiKey: cfg.apiKey });
      if (check.available) {
        availabilityFields = {
          availabilityStatus: "available",
          lastAvailabilityCheckedAt: new Date(),
          isEmbeddable: check.isEmbeddable,
          isPublic: check.isPublic,
          uploadStatus: check.uploadStatus,
          liveBroadcastContent: check.liveBroadcastContent,
          qualityDefinition: check.qualityDefinition,
          unavailableReason: null,
        };
      } else {
        availabilityFields = {
          availabilityStatus: "unavailable",
          lastAvailabilityCheckedAt: new Date(),
          isEmbeddable: check.isEmbeddable,
          isPublic: check.isPublic,
          uploadStatus: check.uploadStatus ?? null,
          liveBroadcastContent: check.liveBroadcastContent ?? null,
          qualityDefinition: check.qualityDefinition ?? null,
          unavailableReason: check.reason,
        };
        throw new Error(`Video is not available for embedding: ${check.reason}`);
      }
    }
  }

  // If setting as primary, unset other primaries
  if (input.isPrimary) {
    await prisma.recipeMediaReference.updateMany({
      where: { recipeId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const ref = await prisma.recipeMediaReference.create({
    data: {
      recipeId,
      type: input.type,
      provider: input.provider,
      title: input.title,
      url: normalizedUrl ?? input.url,
      normalizedUrl,
      embedUrl,
      externalId,
      language: input.language ?? null,
      creatorName: input.creatorName ?? null,
      durationSeconds: input.durationSeconds ?? null,
      isPrimary: input.isPrimary,
      displayOrder: input.displayOrder,
      notes: input.notes ?? null,
      availabilityStatus: availabilityFields.availabilityStatus,
      lastAvailabilityCheckedAt: availabilityFields.lastAvailabilityCheckedAt,
      isEmbeddable: availabilityFields.isEmbeddable,
      isPublic: availabilityFields.isPublic,
      uploadStatus: availabilityFields.uploadStatus,
      liveBroadcastContent: availabilityFields.liveBroadcastContent,
      qualityDefinition: availabilityFields.qualityDefinition,
      unavailableReason: availabilityFields.unavailableReason,
    },
  });

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "recipe_media_reference.created",
    targetType: "recipe_media_reference",
    targetId: ref.id,
    details: {
      recipeId,
      type: input.type,
      provider: input.provider,
      availabilityStatus: availabilityFields.availabilityStatus,
    } as Prisma.InputJsonValue,
  });

  return ref;
}

export async function updateMediaReference(params: {
  id: string;
  recipeId: string;
  input: Partial<MediaReferenceCreateInput>;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
}) {
  const { id, recipeId, input, actorUserId, organizationId, countryCode } = params;

  const existing = await prisma.recipeMediaReference.findUnique({ where: { id } });
  if (!existing || existing.recipeId !== recipeId) throw new Error("Media reference not found.");

  if (input.url && !isSafeUrl(input.url)) throw new Error("Invalid or unsafe URL.");

  let normalizedUrl = existing.normalizedUrl;
  let embedUrl = existing.embedUrl;
  let externalId = existing.externalId;

  if (input.url && (input.type === "youtube" || existing.type === "youtube")) {
    const parsed = parseYouTubeUrl(input.url);
    if (!parsed) throw new Error("Invalid YouTube URL.");
    normalizedUrl = parsed.normalizedUrl;
    embedUrl = parsed.embedUrl;
    externalId = parsed.externalId;
  }

  if (input.isPrimary && !existing.isPrimary) {
    await prisma.recipeMediaReference.updateMany({
      where: { recipeId, isPrimary: true, id: { not: id } },
      data: { isPrimary: false },
    });
    await createAuditEvent({
      actorUserId,
      organizationId,
      countryCode,
      action: "recipe_media_reference.primary_changed",
      targetType: "recipe_media_reference",
      targetId: id,
      details: { recipeId } as Prisma.InputJsonValue,
    });
  }

  const updated = await prisma.recipeMediaReference.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.url !== undefined ? { url: normalizedUrl ?? input.url, normalizedUrl, embedUrl, externalId } : {}),
      ...(input.language !== undefined ? { language: input.language ?? null } : {}),
      ...(input.creatorName !== undefined ? { creatorName: input.creatorName ?? null } : {}),
      ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds ?? null } : {}),
      ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
    },
  });

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "recipe_media_reference.updated",
    targetType: "recipe_media_reference",
    targetId: id,
    details: { recipeId } as Prisma.InputJsonValue,
  });

  return updated;
}

export async function deleteMediaReference(params: {
  id: string;
  recipeId: string;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
}) {
  const { id, recipeId, actorUserId, organizationId, countryCode } = params;

  const existing = await prisma.recipeMediaReference.findUnique({ where: { id } });
  if (!existing || existing.recipeId !== recipeId) throw new Error("Media reference not found.");

  await prisma.recipeMediaReference.delete({ where: { id } });

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "recipe_media_reference.deleted",
    targetType: "recipe_media_reference",
    targetId: id,
    details: { recipeId } as Prisma.InputJsonValue,
  });
}
