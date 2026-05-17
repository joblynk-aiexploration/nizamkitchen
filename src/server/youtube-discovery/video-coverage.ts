import { prisma } from "@/lib/prisma";
import { importCandidate } from "./candidate-service";
import type { Prisma } from "@prisma/client";

export type RecipeVideoCoverageStatus = "covered" | "needs_video" | "video_broken" | "unchecked";

export type RecipeVideoCoverage = {
  recipeId: string;
  recipeName: string;
  status: RecipeVideoCoverageStatus;
  availableRefCount: number;
  totalRefCount: number;
  brokenRefCount: number;
  primaryRef: {
    id: string;
    title: string;
    availabilityStatus: string;
    lastAvailabilityCheckedAt: Date | null;
  } | null;
  pendingCandidateCount: number;
  bestCandidateScore: number | null;
};

export type CoverageSummary = {
  total: number;
  covered: number;
  needsVideo: number;
  videoBroken: number;
  unchecked: number;
  coveragePercent: number;
};

const AVAILABLE_REF_WHERE = {
  type: "youtube" as const,
  availabilityStatus: "available",
  isEmbeddable: true,
  isPublic: true,
} as const;

function computeCoverageStatus(params: {
  totalYoutubeRefs: number;
  availableRefs: number;
  uncheckedRefs: number;
  unavailableRefs: number;
}): RecipeVideoCoverageStatus {
  const { totalYoutubeRefs, availableRefs, uncheckedRefs } = params;
  if (totalYoutubeRefs === 0) return "needs_video";
  if (availableRefs > 0) return "covered";
  if (uncheckedRefs > 0) return "unchecked";
  return "video_broken";
}

export async function getRecipeVideoCoverage(recipeId: string): Promise<RecipeVideoCoverage | null> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, name: true },
  });
  if (!recipe) return null;

  const refs = await prisma.recipeMediaReference.findMany({
    where: { recipeId, type: "youtube" },
    select: {
      id: true,
      title: true,
      isPrimary: true,
      availabilityStatus: true,
      lastAvailabilityCheckedAt: true,
      isEmbeddable: true,
      isPublic: true,
    },
    orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
  });

  const availableRefs = refs.filter((r) => r.availabilityStatus === "available" && r.isEmbeddable && r.isPublic);
  const unavailableRefs = refs.filter((r) => r.availabilityStatus === "unavailable" || r.availabilityStatus === "restricted");
  const uncheckedRefs = refs.filter((r) => r.availabilityStatus === "unchecked" || r.availabilityStatus === "unknown");

  const primaryRef = refs.find((r) => r.isPrimary) ?? refs[0] ?? null;

  const pendingCandidateCount = await prisma.youTubeVideoCandidate.count({
    where: { recipeId, status: "pending" },
  });
  const bestCandidate = await prisma.youTubeVideoCandidate.findFirst({
    where: { recipeId, status: "pending" },
    orderBy: { score: "desc" },
    select: { score: true },
  });

  return {
    recipeId: recipe.id,
    recipeName: recipe.name,
    status: computeCoverageStatus({
      totalYoutubeRefs: refs.length,
      availableRefs: availableRefs.length,
      uncheckedRefs: uncheckedRefs.length,
      unavailableRefs: unavailableRefs.length,
    }),
    availableRefCount: availableRefs.length,
    totalRefCount: refs.length,
    brokenRefCount: unavailableRefs.length,
    primaryRef: primaryRef
      ? {
          id: primaryRef.id,
          title: primaryRef.title,
          availabilityStatus: primaryRef.availabilityStatus,
          lastAvailabilityCheckedAt: primaryRef.lastAvailabilityCheckedAt,
        }
      : null,
    pendingCandidateCount,
    bestCandidateScore: bestCandidate?.score ?? null,
  };
}

export async function getAllRecipeVideoCoverage(): Promise<RecipeVideoCoverage[]> {
  const recipes = await prisma.recipe.findMany({
    where: { isPublished: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(recipes.map((r) => getRecipeVideoCoverage(r.id).then((c) => c!)));
}

export async function getCoverageSummary(): Promise<CoverageSummary> {
  const coverage = await getAllRecipeVideoCoverage();
  const total = coverage.length;
  const covered = coverage.filter((c) => c.status === "covered").length;
  const needsVideo = coverage.filter((c) => c.status === "needs_video").length;
  const videoBroken = coverage.filter((c) => c.status === "video_broken").length;
  const unchecked = coverage.filter((c) => c.status === "unchecked").length;

  return {
    total,
    covered,
    needsVideo,
    videoBroken,
    unchecked,
    coveragePercent: total > 0 ? Math.round((covered / total) * 100) : 0,
  };
}

export async function findRecipesMissingVideos(): Promise<string[]> {
  const coverage = await getAllRecipeVideoCoverage();
  return coverage
    .filter((c) => c.status === "needs_video" || c.status === "video_broken")
    .map((c) => c.recipeId);
}

export async function findRecipesWithBrokenVideos(): Promise<string[]> {
  const coverage = await getAllRecipeVideoCoverage();
  return coverage.filter((c) => c.status === "video_broken").map((c) => c.recipeId);
}

// AUTO_IMPORT_THRESHOLD: a candidate must meet ALL of these to be auto-imported without human review
const AUTO_IMPORT_SCORE_THRESHOLD = 50;
const HARD_DISQUALIFIERS = [
  "not embeddable",
  "Short",
  "off-topic",
  "spam",
  "mukbang",
  "eating",
];

function isHardDisqualified(candidate: { rejectionReasonsJson: Prisma.JsonValue }): boolean {
  const reasons = (candidate.rejectionReasonsJson as string[] | null) ?? [];
  return reasons.some((r) => HARD_DISQUALIFIERS.some((d) => r.toLowerCase().includes(d.toLowerCase())));
}

export async function importBestCandidateIfStrictlyQualified(params: {
  recipeId: string;
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
}): Promise<{ imported: true; candidateId: string } | { imported: false; reason: string }> {
  const { recipeId, actorUserId, organizationId, countryCode } = params;

  // Only attempt if recipe has no available video
  const coverage = await getRecipeVideoCoverage(recipeId);
  if (!coverage) return { imported: false, reason: "Recipe not found." };
  if (coverage.status === "covered") return { imported: false, reason: "Recipe already has a working video." };

  const best = await prisma.youTubeVideoCandidate.findFirst({
    where: {
      recipeId,
      status: "pending",
      score: { gte: AUTO_IMPORT_SCORE_THRESHOLD },
    },
    orderBy: { score: "desc" },
  });

  if (!best) {
    return {
      imported: false,
      reason: `No candidate meets the quality threshold (score ≥ ${AUTO_IMPORT_SCORE_THRESHOLD}). Manual review required.`,
    };
  }

  if (isHardDisqualified(best)) {
    return {
      imported: false,
      reason: "Best candidate has hard disqualifier signals. Manual review required.",
    };
  }

  try {
    await importCandidate({
      candidateId: best.id,
      actorUserId,
      organizationId,
      countryCode,
      isPrimary: true,
    });
    return { imported: true, candidateId: best.id };
  } catch (error) {
    return {
      imported: false,
      reason: error instanceof Error ? error.message : "Import failed.",
    };
  }
}

export async function bulkAutoImportForMissingRecipes(params: {
  actorUserId: string;
  organizationId: string | null;
  countryCode: string | null;
}): Promise<{
  attempted: number;
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const missingIds = await findRecipesMissingVideos();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const recipeId of missingIds) {
    const result = await importBestCandidateIfStrictlyQualified({ recipeId, ...params });
    if (result.imported) {
      imported++;
    } else {
      skipped++;
      if (!result.reason.includes("quality threshold") && !result.reason.includes("already has")) {
        errors.push(`${recipeId}: ${result.reason}`);
      }
    }
  }

  return { attempted: missingIds.length, imported, skipped, errors };
}

// Check if a recipe has a valid, available primary video
export async function hasVerifiedVideo(recipeId: string): Promise<boolean> {
  const count = await prisma.recipeMediaReference.count({
    where: { recipeId, ...AVAILABLE_REF_WHERE },
  });
  return count > 0;
}
