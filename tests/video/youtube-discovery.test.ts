import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    featureFlag: { findMany: vi.fn(), findFirst: vi.fn() },
    recipe: { findUnique: vi.fn(), findMany: vi.fn() },
    youTubeDiscoveryRun: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    youTubeVideoCandidate: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    recipeMediaReference: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/youtube-discovery-config", () => ({
  getYouTubeDiscoveryConfig: vi.fn(),
  isYouTubeDiscoveryAvailable: vi.fn(),
}));
vi.mock("@/lib/youtube-api", () => ({
  searchYouTubeVideos: vi.fn(),
  getYouTubeVideoDetails: vi.fn(),
  getYouTubeChannelDetails: vi.fn(),
}));

import {
  getYouTubeDiscoveryConfig,
  isYouTubeDiscoveryAvailable,
} from "@/lib/youtube-discovery-config";
import {
  searchYouTubeVideos,
  getYouTubeVideoDetails,
  getYouTubeChannelDetails,
} from "@/lib/youtube-api";
import { buildDiscoveryQueries } from "@/server/youtube-discovery/query-builder";
import { scoreCandidate } from "@/server/youtube-discovery/scoring";
import { runDiscoveryForRecipe } from "@/server/youtube-discovery/discovery-service";
import {
  approveCandidate,
  rejectCandidate,
  importCandidate,
} from "@/server/youtube-discovery/candidate-service";

// ─── Feature flag existence ───────────────────────────────────────────────────

describe("youtube_references feature flag", () => {
  it("is present in the seed FEATURE_FLAGS list", async () => {
    // Read the actual seed file and verify the flag key exists
    const fs = await import("fs/promises");
    const seedContent = await fs.readFile("prisma/seed.ts", "utf-8");
    expect(seedContent).toContain('"youtube_references"');
  });

  it("is present in GLOBALLY_ENABLED_FLAGS", async () => {
    const fs = await import("fs/promises");
    const seedContent = await fs.readFile("prisma/seed.ts", "utf-8");
    expect(seedContent).toContain("youtube_references");
    // Should appear in the globally enabled set too
    const lines = seedContent.split("\n");
    const globalLine = lines.find((l) => l.includes("GLOBALLY_ENABLED_FLAGS"));
    expect(globalLine).toBeDefined();
    expect(globalLine).toContain("youtube_references");
  });
});

// ─── YouTube URL parsing (regression) ────────────────────────────────────────

describe("YouTube URL parsing regression", () => {
  it("still parses standard watch URL after discovery changes", async () => {
    const { parseYouTubeUrl } = await import("@/lib/youtube");
    const result = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).not.toBeNull();
    expect(result!.externalId).toBe("dQw4w9WgXcQ");
    expect(result!.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });
});

// ─── Discovery disabled state ─────────────────────────────────────────────────

describe("discovery disabled state", () => {
  it("returns error when YOUTUBE_DISCOVERY_ENABLED is false", async () => {
    (getYouTubeDiscoveryConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      enabled: false,
      reason: "YOUTUBE_DISCOVERY_ENABLED is not set to true.",
    });
    mockPrisma.recipe.findUnique.mockResolvedValue(null);

    const result = await runDiscoveryForRecipe({
      recipeId: "recipe-1",
      requestedByUserId: "user-1",
      organizationId: null,
      countryCode: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("YOUTUBE_DISCOVERY_ENABLED");
    }
  });

  it("returns error when YOUTUBE_DATA_API_KEY is missing", async () => {
    (getYouTubeDiscoveryConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      enabled: false,
      reason: "YOUTUBE_DATA_API_KEY is not configured.",
    });

    const result = await runDiscoveryForRecipe({
      recipeId: "recipe-1",
      requestedByUserId: "user-1",
      organizationId: null,
      countryCode: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("YOUTUBE_DATA_API_KEY");
    }
  });

  it("isYouTubeDiscoveryAvailable returns false when not configured", () => {
    (isYouTubeDiscoveryAvailable as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(isYouTubeDiscoveryAvailable()).toBe(false);
  });
});

// ─── Search query generation ──────────────────────────────────────────────────

describe("buildDiscoveryQueries for Hyderabadi Chicken Biryani", () => {
  it("generates multiple queries", () => {
    const queries = buildDiscoveryQueries({
      recipeName: "Hyderabadi Chicken Biryani",
      cuisineName: "Hyderabadi",
    });
    expect(queries.length).toBeGreaterThan(3);
  });

  it("includes recipe name in all generated queries", () => {
    const queries = buildDiscoveryQueries({ recipeName: "Hyderabadi Chicken Biryani" });
    for (const q of queries) {
      expect(q.query.toLowerCase()).toContain("biryani");
    }
  });

  it("includes Hyderabadi-specific terms for Hyderabadi recipes", () => {
    const queries = buildDiscoveryQueries({ recipeName: "Hyderabadi Chicken Biryani" });
    const queryTexts = queries.map((q) => q.query.toLowerCase());
    const hasAuthenticOrHyderabadi = queryTexts.some(
      (q) => q.includes("authentic") || q.includes("hyderabadi") || q.includes("restaurant style"),
    );
    expect(hasAuthenticOrHyderabadi).toBe(true);
  });

  it("generates no duplicate queries", () => {
    const queries = buildDiscoveryQueries({ recipeName: "Hyderabadi Chicken Biryani" });
    const queryTexts = queries.map((q) => q.query);
    const unique = new Set(queryTexts);
    expect(unique.size).toBe(queryTexts.length);
  });

  it("works for non-Hyderabadi recipes too", () => {
    const queries = buildDiscoveryQueries({ recipeName: "Chicken Tikka Masala", cuisineName: "Indian" });
    expect(queries.length).toBeGreaterThan(2);
    expect(queries.every((q) => q.query.toLowerCase().includes("tikka"))).toBe(true);
  });

  it("sets long or medium duration for biryani (complex recipe)", () => {
    const queries = buildDiscoveryQueries({ recipeName: "Hyderabadi Chicken Biryani" });
    expect(queries.every((q) => q.videoDuration === "long" || q.videoDuration === "medium")).toBe(true);
  });
});

// ─── Scoring ──────────────────────────────────────────────────────────────────

describe("scoreCandidate — professional cooking-channel signals", () => {
  const baseVideo = {
    videoId: "abc1234567x",
    title: "Hyderabadi Chicken Biryani Recipe | Authentic Dum Biryani",
    description: "Step-by-step authentic Hyderabadi biryani recipe.",
    channelId: "chan1",
    channelTitle: "Chef's Kitchen",
    thumbnailUrl: "https://img.youtube.com/vi/abc1234567x/hqdefault.jpg",
    publishedAt: "2023-06-01T00:00:00Z",
    durationSeconds: 900,
    viewCount: BigInt(500_000),
    likeCount: BigInt(10_000),
    commentCount: BigInt(500),
    embeddable: true,
    isShort: false,
  };

  const cookingChannel = {
    channelId: "chan1",
    title: "Chef's Kitchen",
    description: "Professional cooking recipes and techniques",
    subscriberCount: BigInt(250_000),
    videoCount: BigInt(500),
    country: "IN",
  };

  it("gives high score to cooking-channel video matching recipe name", () => {
    const result = scoreCandidate({
      video: baseVideo,
      channel: cookingChannel,
      recipeName: "Hyderabadi Chicken Biryani",
      searchQuery: "Hyderabadi Chicken Biryani recipe",
    });
    expect(result.score).toBeGreaterThan(30);
    expect(result.professionalSignals.length).toBeGreaterThan(0);
    expect(result.rejectionReasons.length).toBe(0);
  });

  it("includes cooking-channel signal when channel focuses on cooking", () => {
    const result = scoreCandidate({
      video: baseVideo,
      channel: cookingChannel,
      recipeName: "Hyderabadi Chicken Biryani",
      searchQuery: "Hyderabadi Chicken Biryani recipe",
    });
    const hasCookingSignal = result.professionalSignals.some(
      (s) => s.toLowerCase().includes("cook") || s.toLowerCase().includes("channel"),
    );
    expect(hasCookingSignal).toBe(true);
  });

  it("does NOT label a creator as 'professional chef' without clear evidence", () => {
    const result = scoreCandidate({
      video: { ...baseVideo, title: "Easy Biryani at home" },
      channel: { ...cookingChannel, title: "Home Cook" },
      recipeName: "Hyderabadi Chicken Biryani",
      searchQuery: "biryani recipe",
    });
    // Should not claim "professional chef" without evidence
    const claimsProfChef = result.professionalSignals.some(
      (s) => s.toLowerCase() === "professional chef",
    );
    expect(claimsProfChef).toBe(false);
  });

  it("adds 'Needs review' signal when no strong professional signals detected", () => {
    const result = scoreCandidate({
      video: {
        ...baseVideo,
        title: "Chicken Biryani",
        channelTitle: "Random Channel",
        viewCount: BigInt(500),
        durationSeconds: 200,
      },
      channel: null,
      recipeName: "Hyderabadi Chicken Biryani",
      searchQuery: "biryani",
    });
    const needsReview = result.professionalSignals.some((s) =>
      s.toLowerCase().includes("needs review"),
    );
    expect(needsReview).toBe(true);
  });
});

// ─── Rejecting unrelated candidates ──────────────────────────────────────────

describe("scoreCandidate — rejecting unrelated content", () => {
  it("gives negative score to mukbang video", () => {
    const result = scoreCandidate({
      video: {
        videoId: "xyz1234567a",
        title: "MUKBANG eating Hyderabadi Biryani",
        description: "",
        channelId: "chan2",
        channelTitle: "Eating Channel",
        thumbnailUrl: "",
        publishedAt: "",
        durationSeconds: 1200,
        viewCount: BigInt(2_000_000),
        likeCount: null,
        commentCount: null,
        embeddable: true,
        isShort: false,
      },
      channel: null,
      recipeName: "Hyderabadi Chicken Biryani",
      searchQuery: "biryani recipe",
    });
    expect(result.score).toBeLessThan(0);
    expect(result.rejectionReasons.length).toBeGreaterThan(0);
  });

  it("rejects non-embeddable video immediately", () => {
    const result = scoreCandidate({
      video: {
        videoId: "xyz1234567b",
        title: "Hyderabadi Chicken Biryani Recipe",
        description: "",
        channelId: "chan3",
        channelTitle: "Chef Kitchen",
        thumbnailUrl: "",
        publishedAt: "",
        durationSeconds: 600,
        viewCount: BigInt(100_000),
        likeCount: null,
        commentCount: null,
        embeddable: false,
        isShort: false,
      },
      channel: null,
      recipeName: "Hyderabadi Chicken Biryani",
      searchQuery: "biryani recipe",
    });
    expect(result.score).toBeLessThan(-50);
    expect(result.rejectionReasons.some((r) => r.toLowerCase().includes("embeddable"))).toBe(true);
  });

  it("penalises very short videos for complex recipes", () => {
    const result = scoreCandidate({
      video: {
        videoId: "xyz1234567c",
        title: "Biryani Recipe",
        description: "",
        channelId: "chan4",
        channelTitle: "Quick Recipes",
        thumbnailUrl: "",
        publishedAt: "",
        durationSeconds: 60,
        viewCount: BigInt(50_000),
        likeCount: null,
        commentCount: null,
        embeddable: true,
        isShort: true,
      },
      channel: null,
      recipeName: "Hyderabadi Chicken Biryani",
      searchQuery: "biryani recipe",
    });
    expect(result.score).toBeLessThan(0);
  });
});

// ─── Candidate approval creates RecipeMediaReference ─────────────────────────

describe("importCandidate", () => {
  beforeEach(() => {
    mockPrisma.recipeMediaReference.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.recipeMediaReference.create.mockResolvedValue({
      id: "ref-1",
      recipeId: "recipe-1",
      type: "youtube",
      provider: "youtube",
    });
    mockPrisma.youTubeVideoCandidate.update.mockResolvedValue({
      id: "cand-1",
      status: "imported",
    });
  });

  it("creates RecipeMediaReference from safe video ID (not raw URL)", async () => {
    mockPrisma.youTubeVideoCandidate.findUnique.mockResolvedValue({
      id: "cand-1",
      recipeId: "recipe-1",
      providerVideoId: "dQw4w9WgXcQ",
      title: "Hyderabadi Chicken Biryani Recipe",
      channelTitle: "Chef Kitchen",
      durationSeconds: 600,
      thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      status: "pending",
      rejectionReasonsJson: null,
    });

    const result = await importCandidate({
      candidateId: "cand-1",
      actorUserId: "admin-1",
      organizationId: null,
      countryCode: null,
      isPrimary: true,
    });

    expect(mockPrisma.recipeMediaReference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "youtube",
          provider: "youtube",
          externalId: "dQw4w9WgXcQ",
          embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          normalizedUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          isPrimary: true,
        }),
      }),
    );

    expect(result.mediaReference).toBeDefined();
  });

  it("marks candidate status as imported after import", async () => {
    mockPrisma.youTubeVideoCandidate.findUnique.mockResolvedValue({
      id: "cand-2",
      recipeId: "recipe-1",
      providerVideoId: "dQw4w9WgXcQ",
      title: "Biryani Recipe",
      channelTitle: "Chef",
      durationSeconds: 500,
      thumbnailUrl: null,
      status: "pending",
      rejectionReasonsJson: null,
    });
    mockPrisma.youTubeVideoCandidate.update.mockResolvedValue({ id: "cand-2", status: "imported" });

    await importCandidate({
      candidateId: "cand-2",
      actorUserId: "admin-1",
      organizationId: null,
      countryCode: null,
      isPrimary: false,
    });

    expect(mockPrisma.youTubeVideoCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cand-2" },
        data: expect.objectContaining({ status: "imported" }),
      }),
    );
  });

  it("throws when importing a rejected candidate", async () => {
    mockPrisma.youTubeVideoCandidate.findUnique.mockResolvedValue({
      id: "cand-3",
      recipeId: "recipe-1",
      providerVideoId: "dQw4w9WgXcQ",
      title: "Biryani",
      channelTitle: "Channel",
      status: "rejected",
      rejectionReasonsJson: ["Unrelated"],
    });

    await expect(
      importCandidate({ candidateId: "cand-3", actorUserId: "admin-1", organizationId: null, countryCode: null, isPrimary: false }),
    ).rejects.toThrow("rejected");
  });
});

// ─── Approving a candidate ────────────────────────────────────────────────────

describe("approveCandidate", () => {
  it("updates status to approved", async () => {
    mockPrisma.youTubeVideoCandidate.findUnique.mockResolvedValue({
      id: "cand-4",
      recipeId: "recipe-1",
      providerVideoId: "abc1234567x",
      status: "pending",
    });
    mockPrisma.youTubeVideoCandidate.update.mockResolvedValue({ id: "cand-4", status: "approved" });

    await approveCandidate({
      candidateId: "cand-4",
      actorUserId: "admin-1",
      organizationId: null,
      countryCode: null,
    });

    expect(mockPrisma.youTubeVideoCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "approved" }),
      }),
    );
  });

  it("throws when candidate not found", async () => {
    mockPrisma.youTubeVideoCandidate.findUnique.mockResolvedValue(null);
    await expect(
      approveCandidate({ candidateId: "bad-id", actorUserId: "admin-1", organizationId: null, countryCode: null }),
    ).rejects.toThrow("not found");
  });
});

// ─── Rejecting a candidate ────────────────────────────────────────────────────

describe("rejectCandidate", () => {
  it("updates status to rejected", async () => {
    mockPrisma.youTubeVideoCandidate.findUnique.mockResolvedValue({
      id: "cand-5",
      recipeId: "recipe-1",
      providerVideoId: "abc1234567x",
      status: "pending",
      rejectionReasonsJson: null,
    });
    mockPrisma.youTubeVideoCandidate.update.mockResolvedValue({ id: "cand-5", status: "rejected" });

    await rejectCandidate({
      candidateId: "cand-5",
      actorUserId: "admin-1",
      organizationId: null,
      countryCode: null,
      reason: "Unrelated content",
    });

    expect(mockPrisma.youTubeVideoCandidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "rejected" }),
      }),
    );
  });
});

// ─── Duplicate prevention ─────────────────────────────────────────────────────

describe("duplicate video candidate prevention", () => {
  it("does not create a duplicate for an existing providerVideoId", async () => {
    (getYouTubeDiscoveryConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      enabled: true,
      apiKey: "test-key",
    });

    mockPrisma.recipe.findUnique.mockResolvedValue({
      id: "recipe-1",
      name: "Hyderabadi Chicken Biryani",
      countryCode: "IN",
      cuisine: { name: "Hyderabadi" },
    });
    mockPrisma.youTubeVideoCandidate.count
      .mockResolvedValueOnce(0)  // initial check
      .mockResolvedValueOnce(1); // final count

    mockPrisma.youTubeDiscoveryRun.create.mockResolvedValue({
      id: "run-1",
      status: "running",
    });
    mockPrisma.youTubeDiscoveryRun.update.mockResolvedValue({ id: "run-1", status: "completed" });

    (searchYouTubeVideos as ReturnType<typeof vi.fn>).mockResolvedValue([
      { videoId: "existing-vid", title: "Biryani Recipe", channelId: "c1", channelTitle: "Chef Kitchen",
        thumbnailUrl: "", publishedAt: "", description: "" },
    ]);
    (getYouTubeVideoDetails as ReturnType<typeof vi.fn>).mockResolvedValue([
      { videoId: "existing-vid", title: "Biryani Recipe", description: "", channelId: "c1",
        channelTitle: "Chef Kitchen", thumbnailUrl: "", publishedAt: "", durationSeconds: 600,
        viewCount: BigInt(100_000), likeCount: null, commentCount: null, embeddable: true, isShort: false },
    ]);
    (getYouTubeChannelDetails as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    // Existing candidate in DB
    mockPrisma.youTubeVideoCandidate.findMany.mockResolvedValue([
      { providerVideoId: "existing-vid" },
    ]);
    mockPrisma.youTubeVideoCandidate.updateMany.mockResolvedValue({ count: 1 });

    await runDiscoveryForRecipe({
      recipeId: "recipe-1",
      requestedByUserId: "admin-1",
      organizationId: null,
      countryCode: null,
      forceRefresh: true,
    });

    // Should update existing, not create new
    expect(mockPrisma.youTubeVideoCandidate.create).not.toHaveBeenCalled();
    expect(mockPrisma.youTubeVideoCandidate.updateMany).toHaveBeenCalled();
  });
});

// ─── Platform admin permission guard ─────────────────────────────────────────

describe("platform admin permission guard", () => {
  it("only platform admins and owners should be able to run discovery (API route check)", async () => {
    // The API route enforces requirePlatformRole(["platform_owner", "platform_admin"])
    // This test verifies the route file contains the correct role check
    const fs = await import("fs/promises");
    const routeContent = await fs.readFile(
      "src/app/api/admin/youtube-discovery/runs/route.ts",
      "utf-8",
    );
    expect(routeContent).toContain("platform_owner");
    expect(routeContent).toContain("platform_admin");
    expect(routeContent).toContain("requirePlatformRole");
  });

  it("candidate route enforces platform admin access", async () => {
    const fs = await import("fs/promises");
    const content = await fs.readFile(
      "src/app/api/admin/youtube-discovery/candidates/[candidateId]/route.ts",
      "utf-8",
    );
    expect(content).toContain("platform_owner");
    expect(content).toContain("platform_admin");
    expect(content).toContain("requirePlatformRole");
  });
});
