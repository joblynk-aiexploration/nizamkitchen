import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { parseYouTubeUrl } from "@/lib/youtube";
import type { Prisma } from "@prisma/client";

const CANDIDATE_INCLUDE = {
  recipe: { select: { id: true, name: true, organizationId: true } },
  reviewedBy: { select: { fullName: true } },
} as const;

export async function listCandidatesForRecipe(recipeId: string) {
  return prisma.youTubeVideoCandidate.findMany({
    where: { recipeId },
    include: CANDIDATE_INCLUDE,
    orderBy: [{ status: "asc" }, { score: "desc" }],
  });
}

export async function getPendingCandidatesForRecipe(recipeId: string) {
  return prisma.youTubeVideoCandidate.findMany({
    where: { recipeId, status: "pending" },
    include: CANDIDATE_INCLUDE,
    orderBy: { score: "desc" },
  });
}

export async function getCandidateById(id: string) {
  return prisma.youTubeVideoCandidate.findUnique({
    where: { id },
    include: CANDIDATE_INCLUDE,
  });
}

export async function approveCandidate(params: {
  candidateId: string;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
}) {
  const { candidateId, actorUserId, organizationId, countryCode } = params;

  const candidate = await prisma.youTubeVideoCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error("Candidate not found.");
  if (candidate.status === "imported") throw new Error("Candidate already imported.");

  const updated = await prisma.youTubeVideoCandidate.update({
    where: { id: candidateId },
    data: { status: "approved", reviewedByUserId: actorUserId, reviewedAt: new Date() },
  });

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "youtube_candidate.approved",
    targetType: "youtube_video_candidate",
    targetId: candidateId,
    details: { recipeId: candidate.recipeId, providerVideoId: candidate.providerVideoId } as Prisma.InputJsonValue,
  });

  return updated;
}

export async function rejectCandidate(params: {
  candidateId: string;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
  reason?: string;
}) {
  const { candidateId, actorUserId, organizationId, countryCode, reason } = params;

  const candidate = await prisma.youTubeVideoCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error("Candidate not found.");

  const existing = (candidate.rejectionReasonsJson as string[] | null) ?? [];
  const reasons = reason ? [...existing, reason] : existing;

  const updated = await prisma.youTubeVideoCandidate.update({
    where: { id: candidateId },
    data: {
      status: "rejected",
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
      rejectionReasonsJson: reasons as Prisma.InputJsonValue,
    },
  });

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "youtube_candidate.rejected",
    targetType: "youtube_video_candidate",
    targetId: candidateId,
    details: { recipeId: candidate.recipeId, providerVideoId: candidate.providerVideoId, reason } as Prisma.InputJsonValue,
  });

  return updated;
}

export async function importCandidate(params: {
  candidateId: string;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
  isPrimary: boolean;
}) {
  const { candidateId, actorUserId, organizationId, countryCode, isPrimary } = params;

  const candidate = await prisma.youTubeVideoCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) throw new Error("Candidate not found.");
  if (candidate.status === "rejected") throw new Error("Cannot import rejected candidate.");
  if (candidate.status === "imported") throw new Error("Candidate already imported.");

  // Build safe embed/normalized URLs from providerVideoId (never from raw stored URL)
  const parsed = parseYouTubeUrl(`https://www.youtube.com/watch?v=${candidate.providerVideoId}`);
  if (!parsed) throw new Error("Could not parse candidate video ID.");

  // Unset existing primary if needed
  if (isPrimary) {
    await prisma.recipeMediaReference.updateMany({
      where: { recipeId: candidate.recipeId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const ref = await prisma.recipeMediaReference.create({
    data: {
      recipeId: candidate.recipeId,
      type: "youtube",
      provider: "youtube",
      title: candidate.title,
      url: parsed.normalizedUrl,
      normalizedUrl: parsed.normalizedUrl,
      embedUrl: parsed.embedUrl,
      externalId: candidate.providerVideoId,
      creatorName: candidate.channelTitle ?? null,
      durationSeconds: candidate.durationSeconds ?? null,
      thumbnailUrl: candidate.thumbnailUrl ?? null,
      isPrimary,
      displayOrder: 0,
    },
  });

  await prisma.youTubeVideoCandidate.update({
    where: { id: candidateId },
    data: { status: "imported", reviewedByUserId: actorUserId, reviewedAt: new Date() },
  });

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "youtube_candidate.imported",
    targetType: "youtube_video_candidate",
    targetId: candidateId,
    details: {
      recipeId: candidate.recipeId,
      providerVideoId: candidate.providerVideoId,
      mediaReferenceId: ref.id,
      isPrimary,
    } as Prisma.InputJsonValue,
  });

  if (isPrimary) {
    await createAuditEvent({
      actorUserId,
      organizationId,
      countryCode,
      action: "recipe_media_reference.primary_changed",
      targetType: "recipe_media_reference",
      targetId: ref.id,
      details: { recipeId: candidate.recipeId } as Prisma.InputJsonValue,
    });
  }

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "recipe_media_reference.created",
    targetType: "recipe_media_reference",
    targetId: ref.id,
    details: { recipeId: candidate.recipeId, type: "youtube", provider: "youtube" } as Prisma.InputJsonValue,
  });

  return { candidate: await prisma.youTubeVideoCandidate.findUnique({ where: { id: candidateId } }), mediaReference: ref };
}

export async function listCandidatesGroupedByRecipe() {
  const candidates = await prisma.youTubeVideoCandidate.findMany({
    where: { status: "pending" },
    include: {
      recipe: { select: { id: true, name: true } },
    },
    orderBy: [{ recipeId: "asc" }, { score: "desc" }],
  });

  const grouped = new Map<string, { recipe: { id: string; name: string }; candidates: typeof candidates }>();
  for (const c of candidates) {
    if (!grouped.has(c.recipeId)) {
      grouped.set(c.recipeId, { recipe: c.recipe, candidates: [] });
    }
    grouped.get(c.recipeId)!.candidates.push(c);
  }
  return [...grouped.values()];
}
