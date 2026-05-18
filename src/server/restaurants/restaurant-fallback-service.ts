import { prisma } from "@/lib/prisma";
import { createAuditEvent } from "@/server/audit";
import { createAdminNotification } from "@/server/notifications/notification-service";
import { isRestaurantDiscoveryAvailable } from "@/lib/restaurant-config";
import {
  buildRestaurantQueriesForRecipe,
  buildRestaurantQueriesForQuery,
} from "@/lib/restaurant-search";
import { searchMapTilerPlaces } from "./maptiler-service";
import type { Prisma } from "@prisma/client";
import type { RestaurantSearchInput, SavedRestaurantCreateInput } from "@/lib/validation/restaurants";

// ─── Search ───────────────────────────────────────────────────────────────────

export async function runRestaurantSearch(params: {
  actorUserId: string;
  organizationId: string;
  countryCode: string;
  input: RestaurantSearchInput;
}): Promise<{ searchId: string }> {
  const { actorUserId, organizationId, countryCode, input } = params;

  const search = await prisma.restaurantFallbackSearch.create({
    data: {
      organizationId,
      countryCode,
      createdById: actorUserId,
      recipeId: input.recipeId ?? null,
      mealPlanEntryId: input.mealPlanEntryId ?? null,
      query: input.query,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      status: "pending",
    },
  });

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "restaurant_fallback.search_created",
    targetType: "restaurant_fallback_search",
    targetId: search.id,
    details: { query: input.query, city: input.city } as Prisma.InputJsonValue,
  });

  if (!isRestaurantDiscoveryAvailable()) {
    await prisma.restaurantFallbackSearch.update({
      where: { id: search.id },
      data: { status: "failed", errorMessage: "MapTiler not configured." },
    });
    await createAuditEvent({
      actorUserId,
      organizationId,
      countryCode,
      action: "restaurant_fallback.search_failed",
      targetType: "restaurant_fallback_search",
      targetId: search.id,
      details: { reason: "MapTiler not configured" } as Prisma.InputJsonValue,
    });
    await createAdminNotification({
      organizationId,
      countryCode,
      type: "restaurant_search_failed",
      title: "Restaurant search failed",
      body: `Restaurant fallback search for "${input.query}" failed because MapTiler is not configured.`,
      actionUrl: "/admin/restaurant-fallback",
      priority: "high",
    });
    return { searchId: search.id };
  }

  try {
    // Build query list — prefer recipe-specific if we have a recipeId
    let queries: string[];
    if (input.recipeId) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: input.recipeId },
        select: { name: true },
      });
      queries = recipe
        ? buildRestaurantQueriesForRecipe(recipe.name, input.city)
        : buildRestaurantQueriesForQuery(input.query, input.city);
    } else {
      queries = buildRestaurantQueriesForQuery(input.query, input.city);
    }

    // Run only the first 2 queries to avoid over-querying
    const seenIds = new Set<string>();
    const allResults: Awaited<ReturnType<typeof searchMapTilerPlaces>> = [];

    for (const q of queries.slice(0, 2)) {
      const results = await searchMapTilerPlaces({
        query: q,
        latitude: input.latitude,
        longitude: input.longitude,
        limit: 10,
      });
      for (const r of results) {
        if (!seenIds.has(r.providerPlaceId)) {
          seenIds.add(r.providerPlaceId);
          allResults.push(r);
        }
      }
      if (allResults.length >= 10) break;
    }

    // Store results
    if (allResults.length > 0) {
      await prisma.restaurantFallbackResult.createMany({
        data: allResults.map((r) => ({
          searchId: search.id,
          organizationId,
          countryCode,
          provider: "maptiler" as const,
          providerPlaceId: r.providerPlaceId,
          name: r.name,
          address: r.address,
          latitude: r.latitude,
          longitude: r.longitude,
          category: r.category,
          mapUrl: r.mapUrl,
          rawJson: r.rawJson as Prisma.InputJsonValue,
        })),
      });
    }

    await prisma.restaurantFallbackSearch.update({
      where: { id: search.id },
      data: { status: "completed", resultCount: allResults.length },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await prisma.restaurantFallbackSearch.update({
      where: { id: search.id },
      data: { status: "failed", errorMessage: msg },
    });
    await createAuditEvent({
      actorUserId,
      organizationId,
      countryCode,
      action: "restaurant_fallback.search_failed",
      targetType: "restaurant_fallback_search",
      targetId: search.id,
      details: { error: msg } as Prisma.InputJsonValue,
    });
    await createAdminNotification({
      organizationId,
      countryCode,
      type: "restaurant_search_failed",
      title: "Restaurant search failed",
      body: `Restaurant fallback search for "${input.query}" failed. Check provider configuration and server logs.`,
      actionUrl: "/admin/restaurant-fallback",
      priority: "high",
    });
  }

  return { searchId: search.id };
}

export async function getSearchWithResults(searchId: string, organizationId: string) {
  return prisma.restaurantFallbackSearch.findFirst({
    where: { id: searchId, organizationId },
    include: {
      results: { orderBy: { createdAt: "asc" } },
      recipe: { select: { id: true, name: true } },
    },
  });
}

export async function listSearches(organizationId: string) {
  return prisma.restaurantFallbackSearch.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      recipe: { select: { id: true, name: true } },
      _count: { select: { results: true } },
    },
  });
}

// ─── Saved Restaurants ────────────────────────────────────────────────────────

export async function saveRestaurant(params: {
  actorUserId: string;
  organizationId: string;
  countryCode: string;
  input: SavedRestaurantCreateInput;
}) {
  const { actorUserId, organizationId, countryCode, input } = params;

  const saved = await prisma.savedRestaurant.create({
    data: {
      organizationId,
      countryCode,
      provider: input.provider,
      providerPlaceId: input.providerPlaceId ?? null,
      name: input.name,
      address: input.address ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      category: input.category ?? null,
      mapUrl: input.mapUrl ?? null,
      notes: input.notes ?? null,
    },
  });

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "restaurant.saved",
    targetType: "saved_restaurant",
    targetId: saved.id,
    details: { name: input.name } as Prisma.InputJsonValue,
  });

  return saved;
}

export async function unsaveRestaurant(params: {
  actorUserId: string;
  organizationId: string;
  countryCode: string;
  savedRestaurantId: string;
}) {
  const { actorUserId, organizationId, countryCode, savedRestaurantId } = params;

  const existing = await prisma.savedRestaurant.findFirst({
    where: { id: savedRestaurantId, organizationId },
  });

  if (!existing) return null;

  await prisma.savedRestaurant.delete({ where: { id: savedRestaurantId } });

  await createAuditEvent({
    actorUserId,
    organizationId,
    countryCode,
    action: "restaurant.unsaved",
    targetType: "saved_restaurant",
    targetId: savedRestaurantId,
    details: { name: existing.name } as Prisma.InputJsonValue,
  });

  return existing;
}

export async function listSavedRestaurants(organizationId: string) {
  return prisma.savedRestaurant.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

// ─── Admin metrics ────────────────────────────────────────────────────────────

export async function getRestaurantFallbackMetrics(opts?: {
  countryCode?: string;
}) {
  const where = opts?.countryCode ? { countryCode: opts.countryCode } : {};

  const [totalSearches, failedSearches, savedCount, recentSearches, topQueries] =
    await Promise.all([
      prisma.restaurantFallbackSearch.count({ where }),
      prisma.restaurantFallbackSearch.count({ where: { ...where, status: "failed" } }),
      prisma.savedRestaurant.count({ where }),
      prisma.restaurantFallbackSearch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          recipe: { select: { id: true, name: true } },
          _count: { select: { results: true } },
        },
      }),
      prisma.restaurantFallbackSearch.groupBy({
        by: ["query"],
        where,
        _count: { query: true },
        orderBy: { _count: { query: "desc" } },
        take: 10,
      }),
    ]);

  const searchesByCountry = opts?.countryCode
    ? []
    : await prisma.restaurantFallbackSearch.groupBy({
        by: ["countryCode"],
        _count: { countryCode: true },
        orderBy: { _count: { countryCode: "desc" } },
        take: 10,
      });

  return {
    totalSearches,
    failedSearches,
    savedCount,
    recentSearches,
    topQueries: topQueries.map((q) => ({ query: q.query, count: q._count.query })),
    searchesByCountry: searchesByCountry.map((r) => ({
      countryCode: r.countryCode,
      count: r._count.countryCode,
    })),
  };
}
