import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    recipe: { findUnique: vi.fn(), findMany: vi.fn() },
    recipeMediaReference: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    youTubeVideoCandidate: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    youTubeDiscoveryRun: { findFirst: vi.fn(), findMany: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));
vi.mock("@/lib/youtube-discovery-config", () => ({
  getYouTubeDiscoveryConfig: vi.fn(() => ({ enabled: false, reason: "no key" })),
}));
vi.mock("@/lib/youtube-api", () => ({
  verifyVideoAvailability: vi.fn(),
}));
vi.mock("@/lib/youtube", () => ({
  parseYouTubeUrl: vi.fn(),
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import {
  getRecipeVideoCoverage,
  getCoverageSummary,
  findRecipesMissingVideos,
  findRecipesWithBrokenVideos,
  importBestCandidateIfStrictlyQualified,
  hasVerifiedVideo,
} from "@/server/youtube-discovery/video-coverage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "ref-1",
    title: "Test Video",
    isPrimary: true,
    availabilityStatus: "available",
    lastAvailabilityCheckedAt: new Date("2026-01-01"),
    isEmbeddable: true,
    isPublic: true,
    ...overrides,
  };
}

function setupRecipe(id = "recipe-1", name = "Biryani") {
  mockPrisma.recipe.findUnique.mockResolvedValue({ id, name });
}

function setupCandidates(count = 0, bestScore: number | null = null) {
  mockPrisma.youTubeVideoCandidate.count.mockResolvedValue(count);
  mockPrisma.youTubeVideoCandidate.findFirst.mockResolvedValue(
    bestScore !== null ? { score: bestScore } : null,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRecipeVideoCoverage", () => {
  it("returns covered when recipe has an available embeddable ref", async () => {
    setupRecipe();
    mockPrisma.recipeMediaReference.findMany.mockResolvedValue([makeRef()]);
    setupCandidates(0);

    const result = await getRecipeVideoCoverage("recipe-1");

    expect(result?.status).toBe("covered");
    expect(result?.availableRefCount).toBe(1);
    expect(result?.brokenRefCount).toBe(0);
  });

  it("returns needs_video when no YouTube refs exist", async () => {
    setupRecipe();
    mockPrisma.recipeMediaReference.findMany.mockResolvedValue([]);
    setupCandidates(0);

    const result = await getRecipeVideoCoverage("recipe-1");

    expect(result?.status).toBe("needs_video");
    expect(result?.totalRefCount).toBe(0);
  });

  it("returns video_broken when all refs are unavailable", async () => {
    setupRecipe();
    mockPrisma.recipeMediaReference.findMany.mockResolvedValue([
      makeRef({ availabilityStatus: "unavailable" }),
      makeRef({ id: "ref-2", isPrimary: false, availabilityStatus: "unavailable" }),
    ]);
    setupCandidates(0);

    const result = await getRecipeVideoCoverage("recipe-1");

    expect(result?.status).toBe("video_broken");
    expect(result?.brokenRefCount).toBe(2);
    expect(result?.availableRefCount).toBe(0);
  });

  it("returns unchecked when refs exist but all are unchecked", async () => {
    setupRecipe();
    mockPrisma.recipeMediaReference.findMany.mockResolvedValue([
      makeRef({ availabilityStatus: "unchecked", isEmbeddable: false, isPublic: false }),
    ]);
    setupCandidates(0);

    const result = await getRecipeVideoCoverage("recipe-1");

    expect(result?.status).toBe("unchecked");
  });

  it("returns null for unknown recipe", async () => {
    mockPrisma.recipe.findUnique.mockResolvedValue(null);

    const result = await getRecipeVideoCoverage("nonexistent");

    expect(result).toBeNull();
  });

  it("reports pending candidate count and best score", async () => {
    setupRecipe();
    mockPrisma.recipeMediaReference.findMany.mockResolvedValue([]);
    setupCandidates(3, 62);

    const result = await getRecipeVideoCoverage("recipe-1");

    expect(result?.pendingCandidateCount).toBe(3);
    expect(result?.bestCandidateScore).toBe(62);
  });
});

describe("hasVerifiedVideo", () => {
  it("returns true when there is an available embeddable public YouTube ref", async () => {
    mockPrisma.recipeMediaReference.count.mockResolvedValue(1);
    expect(await hasVerifiedVideo("recipe-1")).toBe(true);
  });

  it("returns false when no qualifying ref exists", async () => {
    mockPrisma.recipeMediaReference.count.mockResolvedValue(0);
    expect(await hasVerifiedVideo("recipe-1")).toBe(false);
  });
});

describe("findRecipesMissingVideos", () => {
  it("returns recipeIds for needs_video and video_broken recipes", async () => {
    mockPrisma.recipe.findMany.mockResolvedValue([
      { id: "r1", name: "Biryani" },
      { id: "r2", name: "Haleem" },
      { id: "r3", name: "Korma" },
    ]);

    // r1: covered, r2: needs_video, r3: video_broken
    mockPrisma.recipe.findUnique
      .mockResolvedValueOnce({ id: "r1", name: "Biryani" })
      .mockResolvedValueOnce({ id: "r2", name: "Haleem" })
      .mockResolvedValueOnce({ id: "r3", name: "Korma" });

    mockPrisma.recipeMediaReference.findMany
      .mockResolvedValueOnce([makeRef()]) // r1 — covered
      .mockResolvedValueOnce([]) // r2 — needs_video
      .mockResolvedValueOnce([makeRef({ availabilityStatus: "unavailable" })]); // r3 — broken

    mockPrisma.youTubeVideoCandidate.count.mockResolvedValue(0);
    mockPrisma.youTubeVideoCandidate.findFirst.mockResolvedValue(null);

    const missing = await findRecipesMissingVideos();

    expect(missing).toContain("r2");
    expect(missing).toContain("r3");
    expect(missing).not.toContain("r1");
  });
});

describe("findRecipesWithBrokenVideos", () => {
  it("returns only video_broken recipes", async () => {
    mockPrisma.recipe.findMany.mockResolvedValue([
      { id: "r1", name: "Biryani" },
      { id: "r2", name: "Haleem" },
    ]);

    mockPrisma.recipe.findUnique
      .mockResolvedValueOnce({ id: "r1", name: "Biryani" })
      .mockResolvedValueOnce({ id: "r2", name: "Haleem" });

    mockPrisma.recipeMediaReference.findMany
      .mockResolvedValueOnce([]) // r1 — needs_video
      .mockResolvedValueOnce([makeRef({ availabilityStatus: "unavailable" })]); // r2 — broken

    mockPrisma.youTubeVideoCandidate.count.mockResolvedValue(0);
    mockPrisma.youTubeVideoCandidate.findFirst.mockResolvedValue(null);

    const broken = await findRecipesWithBrokenVideos();

    expect(broken).toContain("r2");
    expect(broken).not.toContain("r1");
  });
});

describe("importBestCandidateIfStrictlyQualified", () => {
  const actor = { actorUserId: "user-1", organizationId: null, countryCode: null };

  it("skips if recipe already has a working video (covered)", async () => {
    setupRecipe();
    mockPrisma.recipeMediaReference.findMany.mockResolvedValue([makeRef()]);
    setupCandidates(0);

    const result = await importBestCandidateIfStrictlyQualified({ recipeId: "recipe-1", ...actor });

    expect(result.imported).toBe(false);
    expect((result as { imported: false; reason: string }).reason).toMatch(/already has/);
  });

  it("skips if no candidate meets score threshold", async () => {
    setupRecipe();
    mockPrisma.recipeMediaReference.findMany.mockResolvedValue([]);
    mockPrisma.youTubeVideoCandidate.count.mockResolvedValue(0);
    mockPrisma.youTubeVideoCandidate.findFirst
      .mockResolvedValueOnce(null) // for best candidate check
      .mockResolvedValueOnce(null); // for bestCandidateScore in coverage

    const result = await importBestCandidateIfStrictlyQualified({ recipeId: "recipe-1", ...actor });

    expect(result.imported).toBe(false);
    expect((result as { imported: false; reason: string }).reason).toMatch(/threshold/);
  });

  it("skips if best candidate has hard disqualifier in rejectionReasons", async () => {
    setupRecipe();
    mockPrisma.recipeMediaReference.findMany.mockResolvedValue([]);
    mockPrisma.youTubeVideoCandidate.count.mockResolvedValue(1);
    mockPrisma.youTubeVideoCandidate.findFirst
      .mockResolvedValueOnce({
        id: "cand-1",
        score: 60,
        rejectionReasonsJson: ["Video appears to be a Short (too brief for a full recipe)."],
        providerVideoId: "abc123",
        recipeId: "recipe-1",
        status: "pending",
      })
      .mockResolvedValueOnce({ score: 60 }); // for bestCandidateScore

    const result = await importBestCandidateIfStrictlyQualified({ recipeId: "recipe-1", ...actor });

    expect(result.imported).toBe(false);
    expect((result as { imported: false; reason: string }).reason).toMatch(/hard disqualifier/);
  });

  it("returns recipe-not-found if recipe does not exist", async () => {
    mockPrisma.recipe.findUnique.mockResolvedValue(null);

    const result = await importBestCandidateIfStrictlyQualified({ recipeId: "nonexistent", ...actor });

    expect(result.imported).toBe(false);
    expect((result as { imported: false; reason: string }).reason).toMatch(/not found/);
  });
});

describe("getCoverageSummary", () => {
  it("computes correct percentages", async () => {
    mockPrisma.recipe.findMany.mockResolvedValue([
      { id: "r1", name: "A" },
      { id: "r2", name: "B" },
      { id: "r3", name: "C" },
      { id: "r4", name: "D" },
    ]);

    mockPrisma.recipe.findUnique
      .mockResolvedValueOnce({ id: "r1", name: "A" })
      .mockResolvedValueOnce({ id: "r2", name: "B" })
      .mockResolvedValueOnce({ id: "r3", name: "C" })
      .mockResolvedValueOnce({ id: "r4", name: "D" });

    mockPrisma.recipeMediaReference.findMany
      .mockResolvedValueOnce([makeRef()]) // r1 covered
      .mockResolvedValueOnce([]) // r2 needs_video
      .mockResolvedValueOnce([makeRef({ availabilityStatus: "unavailable" })]) // r3 broken
      .mockResolvedValueOnce([makeRef({ availabilityStatus: "unchecked", isEmbeddable: false, isPublic: false })]); // r4 unchecked

    mockPrisma.youTubeVideoCandidate.count.mockResolvedValue(0);
    mockPrisma.youTubeVideoCandidate.findFirst.mockResolvedValue(null);

    const summary = await getCoverageSummary();

    expect(summary.total).toBe(4);
    expect(summary.covered).toBe(1);
    expect(summary.needsVideo).toBe(1);
    expect(summary.videoBroken).toBe(1);
    expect(summary.unchecked).toBe(1);
    expect(summary.coveragePercent).toBe(25);
  });
});
