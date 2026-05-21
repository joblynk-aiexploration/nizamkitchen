import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    restaurantFallbackSearch: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    restaurantFallbackResult: {
      createMany: vi.fn(),
    },
    savedRestaurant: {
      create: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    recipe: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/maps/google-maps-config", () => ({
  getGooglePlacesSearchConfig: vi.fn(),
}));
vi.mock("@/server/maps/google-places-service", () => ({
  searchGooglePlaces: vi.fn(),
}));
vi.mock("@/server/notifications/notification-service", () => ({
  createAdminNotification: vi.fn().mockResolvedValue(undefined),
}));

import {
  runRestaurantSearch,
  saveRestaurant,
  unsaveRestaurant,
} from "@/server/restaurants/restaurant-fallback-service";
import { buildRestaurantQueriesForRecipe, buildRestaurantQueriesForQuery } from "@/lib/restaurant-search";
import { getGooglePlacesSearchConfig } from "@/server/maps/google-maps-config";
import { searchGooglePlaces } from "@/server/maps/google-places-service";

const mockPlacesConfig = vi.mocked(getGooglePlacesSearchConfig);
const mockSearch = vi.mocked(searchGooglePlaces);

const BASE_PARAMS = {
  actorUserId: "user-1",
  organizationId: "org-1",
  countryCode: "IN",
};

const BASE_INPUT = {
  query: "Hyderabadi biryani",
  city: "Hyderabad",
};

// ─── Query builder ────────────────────────────────────────────────────────────

describe("buildRestaurantQueriesForRecipe", () => {
  it("starts with exact recipe name", () => {
    const queries = buildRestaurantQueriesForRecipe("Chicken Biryani", "London");
    expect(queries[0]).toBe("Chicken Biryani London");
  });

  it("includes biryani-specific fallback for biryani recipes", () => {
    const queries = buildRestaurantQueriesForRecipe("Hyderabadi Biryani", "London");
    expect(queries).toContain("biryani restaurant London");
    expect(queries).toContain("Hyderabadi restaurant London");
  });

  it("includes haleem-specific fallback for haleem recipes", () => {
    const queries = buildRestaurantQueriesForRecipe("Haleem Stew");
    expect(queries).toContain("haleem restaurant");
  });

  it("falls back to Hyderabadi restaurant for unknown dishes", () => {
    const queries = buildRestaurantQueriesForRecipe("Osmania Biscuit");
    expect(queries).toContain("Hyderabadi restaurant");
  });

  it("always includes Indian and Pakistani restaurants at the end", () => {
    const queries = buildRestaurantQueriesForRecipe("Any Dish", "City");
    expect(queries).toContain("Indian restaurant City");
    expect(queries).toContain("Pakistani restaurant City");
  });

  it("deduplicates queries", () => {
    const queries = buildRestaurantQueriesForRecipe("Biryani");
    const unique = new Set(queries);
    expect(queries.length).toBe(unique.size);
  });
});

describe("buildRestaurantQueriesForQuery", () => {
  it("returns query with city appended", () => {
    expect(buildRestaurantQueriesForQuery("kebabs", "Houston")).toEqual(["kebabs Houston"]);
  });

  it("returns just query when no city", () => {
    expect(buildRestaurantQueriesForQuery("biryani")).toEqual(["biryani"]);
  });
});

// ─── runRestaurantSearch ──────────────────────────────────────────────────────

describe("runRestaurantSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.restaurantFallbackSearch.create.mockResolvedValue({ id: "search-1" });
    mockPrisma.restaurantFallbackSearch.update.mockResolvedValue({});
    mockPrisma.restaurantFallbackResult.createMany.mockResolvedValue({ count: 1 });
    mockPlacesConfig.mockResolvedValue({
      enabled: true,
      apiKey: "server-key",
      defaultRadiusMeters: 5000,
      regionCode: null,
      reason: null,
    });
  });

  it("marks search as failed when discovery is unavailable", async () => {
    mockPlacesConfig.mockResolvedValue({
      enabled: false,
      apiKey: null,
      defaultRadiusMeters: 5000,
      regionCode: null,
      reason: "Google Maps is not configured. Platform Owner must configure Google Maps keys in Admin Configuration.",
    });

    const result = await runRestaurantSearch({ ...BASE_PARAMS, input: BASE_INPUT });

    expect(result.searchId).toBe("search-1");
    expect(mockPrisma.restaurantFallbackSearch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("calls Google Places and stores results when available", async () => {
    mockSearch.mockResolvedValue([
      {
        name: "Biryani Palace",
        address: "1 Nizam Rd, Hyderabad",
        latitude: 17.38,
        longitude: 78.48,
        category: "restaurant",
        rating: 4.5,
        ratingCount: 120,
        priceLevel: 2,
        openNow: true,
        providerPlaceId: "place-abc",
        mapUrl: "https://www.google.com/maps/place/?q=place_id:place-abc",
        rawJson: {} as never,
      },
    ]);

    const result = await runRestaurantSearch({ ...BASE_PARAMS, input: BASE_INPUT });

    expect(result.searchId).toBe("search-1");
    expect(mockPrisma.restaurantFallbackResult.createMany).toHaveBeenCalled();
    expect(mockPrisma.restaurantFallbackSearch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "completed", resultCount: 1 }),
      }),
    );
  });

  it("does not run more than 2 queries", async () => {
    mockSearch.mockResolvedValue([]);
    mockPrisma.recipe.findUnique.mockResolvedValue({ name: "Chicken Biryani" });

    await runRestaurantSearch({
      ...BASE_PARAMS,
      input: { query: "biryani", recipeId: "recipe-1" },
    });

    expect(mockSearch.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("deduplicates results across queries", async () => {
    const place = {
      name: "Biryani Hut",
      address: null,
      latitude: 17.0,
      longitude: 78.0,
      category: null,
      rating: null,
      ratingCount: null,
      priceLevel: null,
      openNow: null,
      providerPlaceId: "same-id",
      mapUrl: null,
      rawJson: {} as never,
    };
    mockSearch.mockResolvedValue([place]);

    await runRestaurantSearch({ ...BASE_PARAMS, input: BASE_INPUT });

    const createManyCall = mockPrisma.restaurantFallbackResult.createMany.mock.calls[0]?.[0];
    const ids = (createManyCall?.data as { providerPlaceId: string }[]).map((r) => r.providerPlaceId);
    expect(ids.filter((id) => id === "same-id").length).toBe(1);
  });

  it("handles Google Places errors gracefully", async () => {
    mockSearch.mockRejectedValue(new Error("Google Places 500"));

    const result = await runRestaurantSearch({ ...BASE_PARAMS, input: BASE_INPUT });

    expect(result.searchId).toBe("search-1");
    expect(mockPrisma.restaurantFallbackSearch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", errorMessage: "Google Places 500" }),
      }),
    );
  });
});

// ─── saveRestaurant / unsaveRestaurant ────────────────────────────────────────

describe("saveRestaurant", () => {
  it("creates a saved restaurant record", async () => {
    const saved = { id: "saved-1", name: "Test Place", createdAt: new Date() };
    mockPrisma.savedRestaurant.create.mockResolvedValue(saved);

    const result = await saveRestaurant({
      ...BASE_PARAMS,
      input: { name: "Test Place", provider: "google" },
    });

    expect(result.id).toBe("saved-1");
    expect(mockPrisma.savedRestaurant.create).toHaveBeenCalled();
  });
});

describe("unsaveRestaurant", () => {
  it("returns null when not found", async () => {
    mockPrisma.savedRestaurant.findFirst.mockResolvedValue(null);

    const result = await unsaveRestaurant({
      ...BASE_PARAMS,
      savedRestaurantId: "nonexistent",
    });

    expect(result).toBeNull();
    expect(mockPrisma.savedRestaurant.delete).not.toHaveBeenCalled();
  });

  it("deletes the record when found", async () => {
    const existing = { id: "saved-1", name: "Test Place" };
    mockPrisma.savedRestaurant.findFirst.mockResolvedValue(existing);
    mockPrisma.savedRestaurant.delete.mockResolvedValue(existing);

    const result = await unsaveRestaurant({
      ...BASE_PARAMS,
      savedRestaurantId: "saved-1",
    });

    expect(result?.id).toBe("saved-1");
    expect(mockPrisma.savedRestaurant.delete).toHaveBeenCalledWith({ where: { id: "saved-1" } });
  });
});

// ─── Legacy automation guard ──────────────────────────────────────────────────

describe("legacy video-analysis automation is not reintroduced", () => {
  it("restaurant-fallback-service has no AI analysis imports", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("src/server/restaurants/restaurant-fallback-service.ts");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).not.toMatch(/ai[_-]video/i);
    expect(content).not.toMatch(/VideoAnalysis/);
    expect(content).not.toMatch(/AiTraining/);
    expect(content).not.toMatch(/openai|anthropic|gemini/i);
  });

  it("google-places-service has no AI analysis imports", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve("src/server/maps/google-places-service.ts");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).not.toMatch(/ai[_-]video/i);
    expect(content).not.toMatch(/VideoAnalysis/);
    expect(content).not.toMatch(/openai|anthropic|gemini/i);
  });

  it("prisma schema has no legacy video-analysis models", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf-8");

    expect(schema).not.toMatch(/model RecipeVideoAnalysis/);
    expect(schema).not.toMatch(/model AiTrainingExample/);
    expect(schema).not.toMatch(/model VideoAnalysisJob/);
  });

  it("active restaurant fallback code has no legacy map provider implementation", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const activeFiles = [
      "src/server/restaurants/restaurant-fallback-service.ts",
      "src/server/maps/google-places-service.ts",
      "src/server/maps/google-maps-config.ts",
      "src/components/restaurants/restaurant-search-form.tsx",
      "src/components/restaurants/restaurant-result-card.tsx",
    ];
    const legacyProviderPattern = new RegExp(["map", "tiler"].join(""), "i");

    for (const file of activeFiles) {
      const content = fs.readFileSync(path.resolve(file), "utf-8");
      expect(content).not.toMatch(legacyProviderPattern);
    }
  });
});
