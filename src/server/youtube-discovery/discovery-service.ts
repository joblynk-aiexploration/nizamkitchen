import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { getYouTubeDiscoveryConfig } from "@/lib/youtube-discovery-config";
import {
  searchYouTubeVideos,
  getYouTubeVideoDetails,
  getYouTubeChannelDetails,
} from "@/lib/youtube-api";
import { buildDiscoveryQueries } from "./query-builder";
import { scoreCandidate } from "./scoring";
import type { Prisma } from "@prisma/client";

export type DiscoveryRunResult =
  | { success: true; runId: string; candidatesFound: number }
  | { success: false; error: string };

export async function runDiscoveryForRecipe(params: {
  recipeId: string;
  requestedByUserId: string;
  organizationId: string | null;
  countryCode: string | null;
  forceRefresh?: boolean;
}): Promise<DiscoveryRunResult> {
  const { recipeId, requestedByUserId, organizationId, countryCode, forceRefresh = false } = params;

  const cfg = getYouTubeDiscoveryConfig();
  if (!cfg.enabled) {
    return { success: false, error: cfg.reason };
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { cuisine: true },
  });
  if (!recipe) return { success: false, error: "Recipe not found." };

  // If not forcing refresh, check for existing pending/approved candidates
  if (!forceRefresh) {
    const existingCount = await prisma.youTubeVideoCandidate.count({
      where: { recipeId, status: { in: ["pending", "approved", "imported"] } },
    });
    if (existingCount > 0) {
      // Return the most recent run for this recipe
      const lastRun = await prisma.youTubeDiscoveryRun.findFirst({
        where: { recipeId, status: "completed" },
        orderBy: { createdAt: "desc" },
      });
      if (lastRun) {
        return { success: true, runId: lastRun.id, candidatesFound: existingCount };
      }
    }
  }

  const run = await prisma.youTubeDiscoveryRun.create({
    data: {
      recipeId,
      organizationId,
      countryCode,
      requestedByUserId,
      status: "running",
      startedAt: new Date(),
    },
  });

  await createAuditEvent({
    actorUserId: requestedByUserId,
    organizationId,
    countryCode,
    action: "youtube_discovery.started",
    targetType: "youtube_discovery_run",
    targetId: run.id,
    details: { recipeId, recipeName: recipe.name } as Prisma.InputJsonValue,
  });

  try {
    const queries = buildDiscoveryQueries({
      recipeName: recipe.name,
      cuisineName: recipe.cuisine?.name,
      countryCode: recipe.countryCode ?? countryCode ?? undefined,
    });

    // Search phase — collect unique video IDs across all queries
    const videoIdToQuery = new Map<string, string>();
    for (const q of queries) {
      const results = await searchYouTubeVideos({
        query: q.query,
        apiKey: cfg.apiKey,
        maxResults: 8,
        regionCode: q.regionCode,
        videoDuration: q.videoDuration,
      });
      for (const r of results) {
        if (!videoIdToQuery.has(r.videoId)) {
          videoIdToQuery.set(r.videoId, q.query);
        }
      }
    }

    const allVideoIds = [...videoIdToQuery.keys()];

    // Details phase — fetch video + channel metadata in batches of 50
    const allDetails = await getYouTubeVideoDetails({ videoIds: allVideoIds, apiKey: cfg.apiKey });

    const channelIds = [...new Set(allDetails.map((d) => d.channelId).filter(Boolean))];
    const channelDetails = await getYouTubeChannelDetails({ channelIds, apiKey: cfg.apiKey });
    const channelMap = new Map(channelDetails.map((c) => [c.channelId, c]));

    // Scoring + deduplication phase
    const existingIds = new Set(
      (await prisma.youTubeVideoCandidate.findMany({
        where: { recipeId },
        select: { providerVideoId: true },
      })).map((c) => c.providerVideoId),
    );

    let newCandidates = 0;
    for (const video of allDetails) {
      if (!video.embeddable) continue;

      const searchQuery = videoIdToQuery.get(video.videoId) ?? "";
      const channel = channelMap.get(video.channelId) ?? null;

      const scored = scoreCandidate({
        video,
        channel,
        recipeName: recipe.name,
        searchQuery,
      });

      // Skip videos with very negative scores (clearly irrelevant)
      if (scored.score < -30) continue;

      const thumbnailUrl = video.thumbnailUrl || null;

      if (existingIds.has(video.videoId)) {
        // Update score on existing candidate
        await prisma.youTubeVideoCandidate.updateMany({
          where: { recipeId, providerVideoId: video.videoId },
          data: {
            score: scored.score,
            scoreReasonsJson: scored.scoreReasons as Prisma.InputJsonValue,
            professionalSignalsJson: scored.professionalSignals as Prisma.InputJsonValue,
            rejectionReasonsJson: scored.rejectionReasons.length > 0
              ? (scored.rejectionReasons as Prisma.InputJsonValue)
              : undefined,
          },
        });
      } else {
        await prisma.youTubeVideoCandidate.create({
          data: {
            discoveryRunId: run.id,
            recipeId,
            providerVideoId: video.videoId,
            title: video.title,
            description: video.description || null,
            channelId: video.channelId || null,
            channelTitle: video.channelTitle || null,
            thumbnailUrl,
            publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
            durationSeconds: video.durationSeconds,
            viewCount: video.viewCount,
            likeCount: video.likeCount,
            commentCount: video.commentCount,
            searchQuery,
            score: scored.score,
            scoreReasonsJson: scored.scoreReasons as Prisma.InputJsonValue,
            professionalSignalsJson: scored.professionalSignals as Prisma.InputJsonValue,
            rejectionReasonsJson: scored.rejectionReasons.length > 0
              ? (scored.rejectionReasons as Prisma.InputJsonValue)
              : undefined,
          },
        });
        newCandidates++;
        existingIds.add(video.videoId);
      }
    }

    const totalCandidates = await prisma.youTubeVideoCandidate.count({
      where: { recipeId, status: { in: ["pending", "approved", "imported"] } },
    });

    await prisma.youTubeDiscoveryRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        queryCount: queries.length,
        candidatesFound: newCandidates,
        completedAt: new Date(),
      },
    });

    await createAuditEvent({
      actorUserId: requestedByUserId,
      organizationId,
      countryCode,
      action: "youtube_discovery.completed",
      targetType: "youtube_discovery_run",
      targetId: run.id,
      details: { recipeId, newCandidates, totalCandidates } as Prisma.InputJsonValue,
    });

    return { success: true, runId: run.id, candidatesFound: newCandidates };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await prisma.youTubeDiscoveryRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: msg, completedAt: new Date() },
    }).catch(() => undefined);

    await createAuditEvent({
      actorUserId: requestedByUserId,
      organizationId,
      countryCode,
      action: "youtube_discovery.failed",
      targetType: "youtube_discovery_run",
      targetId: run.id,
      details: { recipeId, error: msg } as Prisma.InputJsonValue,
    });

    return { success: false, error: msg };
  }
}

export async function runDiscoveryForAllRecipes(params: {
  requestedByUserId: string;
  organizationId: string | null;
  countryCode: string | null;
  missingOnly?: boolean;
}): Promise<{ started: number; skipped: number; failed: string[] }> {
  const { requestedByUserId, organizationId, countryCode, missingOnly = false } = params;

  const cfg = getYouTubeDiscoveryConfig();
  if (!cfg.enabled) {
    return { started: 0, skipped: 0, failed: [cfg.reason] };
  }

  const recipes = await prisma.recipe.findMany({
    where: { isPublished: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let started = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const recipe of recipes) {
    if (missingOnly) {
      const hasApproved = await prisma.youTubeVideoCandidate.count({
        where: { recipeId: recipe.id, status: { in: ["approved", "imported"] } },
      });
      if (hasApproved > 0) {
        skipped++;
        continue;
      }
    }

    const result = await runDiscoveryForRecipe({
      recipeId: recipe.id,
      requestedByUserId,
      organizationId,
      countryCode,
      forceRefresh: !missingOnly,
    });

    if (result.success) {
      started++;
    } else {
      failed.push(`${recipe.name}: ${result.error}`);
    }
  }

  return { started, skipped, failed };
}

export async function getDiscoveryRunsForRecipe(recipeId: string) {
  return prisma.youTubeDiscoveryRun.findMany({
    where: { recipeId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

export async function listRecentDiscoveryRuns(limit = 20) {
  return prisma.youTubeDiscoveryRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { recipe: { select: { id: true, name: true } } },
  });
}
