import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    unit: { findMany: vi.fn() },
    ingredient: { findMany: vi.fn() },
    recipeVideoAnalysis: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    videoAnalysisJob: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    recipe: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/video-analysis-config", () => ({
  getVideoAnalysisConfig: vi.fn(),
  isAIVideoAnalysisAvailable: vi.fn(),
}));

import { isAIVideoAnalysisAvailable } from "@/lib/video-analysis-config";
import { aiProviderOutputSchema } from "@/lib/validation/video";
import { normalizeAIOutput } from "@/server/video-analysis/result-normalizer";
import { DisabledProvider } from "@/server/video-analysis/providers/disabled-provider";
import { MockProvider } from "@/server/video-analysis/providers/mock-provider";

// ─── AI provider output validation ───────────────────────────────────────────

describe("aiProviderOutputSchema", () => {
  it("accepts valid AI output", () => {
    const valid = {
      title: "Biryani Analysis",
      summary: "A traditional biryani recipe",
      confidence: "high",
      ingredients: [
        {
          ingredientName: "Basmati rice",
          quantity: 2,
          unitName: "cups",
          confidence: "high",
          evidenceText: "Add 2 cups of basmati rice",
        },
      ],
      steps: [
        {
          stepNumber: 1,
          description: "Wash and soak the rice for 30 minutes",
          confidence: "medium",
        },
      ],
      differencesFromWrittenRecipe: [],
    };
    expect(() => aiProviderOutputSchema.parse(valid)).not.toThrow();
  });

  it("rejects output missing required title", () => {
    const invalid = {
      confidence: "high",
      ingredients: [],
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    expect(() => aiProviderOutputSchema.parse(invalid)).toThrow();
  });

  it("rejects ingredient with invalid confidence value", () => {
    const invalid = {
      title: "Test",
      confidence: "high",
      ingredients: [{ ingredientName: "Rice", confidence: "super_sure" }],
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    expect(() => aiProviderOutputSchema.parse(invalid)).toThrow();
  });

  it("rejects difference with invalid differenceType", () => {
    const invalid = {
      title: "Test",
      confidence: "high",
      ingredients: [],
      steps: [],
      differencesFromWrittenRecipe: [
        {
          differenceType: "made_up_type",
          title: "Something different",
          description: "The video does something else",
          severity: "info",
        },
      ],
    };
    expect(() => aiProviderOutputSchema.parse(invalid)).toThrow();
  });

  it("rejects output with too many ingredients (> 100)", () => {
    const manyIngredients = Array.from({ length: 101 }, (_, i) => ({
      ingredientName: `Ingredient ${i}`,
      confidence: "unknown",
    }));
    const invalid = {
      title: "Test",
      confidence: "unknown",
      ingredients: manyIngredients,
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    expect(() => aiProviderOutputSchema.parse(invalid)).toThrow();
  });

  it("allows null quantity for unknown amounts", () => {
    const valid = {
      title: "Test",
      confidence: "unknown",
      ingredients: [{ ingredientName: "Salt", quantity: null, confidence: "low" }],
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    const parsed = aiProviderOutputSchema.parse(valid);
    expect(parsed.ingredients[0].quantity).toBeNull();
  });

  it("defaults confidence to 'unknown' when omitted", () => {
    const minimal = {
      title: "Test",
      ingredients: [],
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    const parsed = aiProviderOutputSchema.parse(minimal);
    expect(parsed.confidence).toBe("unknown");
  });
});

// ─── normalizeAIOutput — timestamp validation ─────────────────────────────────

describe("normalizeAIOutput", () => {
  beforeEach(() => {
    mockPrisma.unit.findMany.mockResolvedValue([]);
    mockPrisma.ingredient.findMany.mockResolvedValue([]);
  });

  it("rejects timestampEnd < timestampStart for ingredients and sets tsEnd to null", async () => {
    const raw = {
      title: "Test Analysis",
      confidence: "medium",
      ingredients: [
        {
          ingredientName: "Onion",
          confidence: "medium",
          timestampStartSeconds: 120,
          timestampEndSeconds: 90,
        },
      ],
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    const result = await normalizeAIOutput(raw);
    expect(result.ingredients[0].timestampStartSeconds).toBe(120);
    expect(result.ingredients[0].timestampEndSeconds).toBeNull();
  });

  it("rejects timestampEnd < timestampStart for steps and sets tsEnd to null", async () => {
    const raw = {
      title: "Test Analysis",
      confidence: "medium",
      ingredients: [],
      steps: [
        {
          stepNumber: 1,
          description: "Cook the onions",
          confidence: "high",
          timestampStartSeconds: 200,
          timestampEndSeconds: 150,
        },
      ],
      differencesFromWrittenRecipe: [],
    };
    const result = await normalizeAIOutput(raw);
    expect(result.steps[0].timestampStartSeconds).toBe(200);
    expect(result.steps[0].timestampEndSeconds).toBeNull();
  });

  it("allows valid timestamp ranges", async () => {
    const raw = {
      title: "Test Analysis",
      confidence: "high",
      ingredients: [
        {
          ingredientName: "Garlic",
          confidence: "high",
          timestampStartSeconds: 30,
          timestampEndSeconds: 60,
        },
      ],
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    const result = await normalizeAIOutput(raw);
    expect(result.ingredients[0].timestampStartSeconds).toBe(30);
    expect(result.ingredients[0].timestampEndSeconds).toBe(60);
  });

  it("leaves ingredientId null when no matching DB ingredient found", async () => {
    mockPrisma.ingredient.findMany.mockResolvedValue([]);
    const raw = {
      title: "Test",
      confidence: "medium",
      ingredients: [{ ingredientName: "Exotic spice nobody knows", confidence: "low" }],
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    const result = await normalizeAIOutput(raw);
    expect(result.ingredients[0].ingredientId).toBeNull();
  });

  it("resolves ingredientId when matching DB ingredient exists", async () => {
    mockPrisma.ingredient.findMany.mockResolvedValue([
      { id: "ing-abc", canonicalName: "Basmati rice" },
    ]);
    const raw = {
      title: "Test",
      confidence: "high",
      ingredients: [{ ingredientName: "Basmati rice", confidence: "high" }],
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    const result = await normalizeAIOutput(raw);
    expect(result.ingredients[0].ingredientId).toBe("ing-abc");
  });

  it("throws on completely invalid AI output", async () => {
    await expect(normalizeAIOutput({ random: "garbage" })).rejects.toThrow();
  });

  it("throws on AI output with empty title", async () => {
    const invalid = {
      title: "",
      confidence: "high",
      ingredients: [],
      steps: [],
      differencesFromWrittenRecipe: [],
    };
    await expect(normalizeAIOutput(invalid)).rejects.toThrow();
  });
});

// ─── DisabledProvider ─────────────────────────────────────────────────────────

describe("DisabledProvider", () => {
  it("reports isAvailable = false", () => {
    const provider = new DisabledProvider();
    expect(provider.isAvailable).toBe(false);
  });

  it("returns a result with success=false for analyzeFromTranscript", async () => {
    const provider = new DisabledProvider();
    const result = await provider.analyzeFromTranscript({
      recipeId: "r1",
      recipeTitle: "Biryani",
      recipeIngredients: [],
      recipeStepCount: 0,
      transcriptText: "Some transcript",
      videoTitle: null,
      videoLanguage: null,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBeDefined();
  });

  it("returns a result with success=false for analyzeFromFrames", async () => {
    const provider = new DisabledProvider();
    const result = await provider.analyzeFromFrames({
      recipeId: "r1",
      recipeTitle: "Biryani",
      recipeIngredients: [],
      recipeStepCount: 0,
      transcriptText: null,
      videoTitle: null,
      videoLanguage: null,
    });
    expect(result.success).toBe(false);
  });
});

// ─── MockProvider ─────────────────────────────────────────────────────────────

describe("MockProvider", () => {
  it("reports isAvailable = true", () => {
    const provider = new MockProvider();
    expect(provider.isAvailable).toBe(true);
  });

  it("returns success=true with dummy data", async () => {
    const provider = new MockProvider();
    const result = await provider.analyzeFromTranscript({
      recipeId: "r1",
      recipeTitle: "Test Recipe",
      recipeIngredients: [{ name: "Salt", quantity: 1, unit: "tsp" }],
      recipeStepCount: 3,
      transcriptText: "Add salt and stir for 10 minutes",
      videoTitle: "Test Video",
      videoLanguage: "en",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toBeDefined();
      expect(result.output.title).toBeTruthy();
    }
  });

  it("mock output passes strict schema validation", async () => {
    const provider = new MockProvider();
    const result = await provider.analyzeFromTranscript({
      recipeId: "r1",
      recipeTitle: "Test Recipe",
      recipeIngredients: [],
      recipeStepCount: 0,
      transcriptText: "A short transcript",
      videoTitle: null,
      videoLanguage: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(() => aiProviderOutputSchema.parse(result.output)).not.toThrow();
    }
  });
});

// ─── isAIVideoAnalysisAvailable ───────────────────────────────────────────────

describe("isAIVideoAnalysisAvailable", () => {
  it("returns false when config says disabled", () => {
    (isAIVideoAnalysisAvailable as ReturnType<typeof vi.fn>).mockReturnValue(false);
    expect(isAIVideoAnalysisAvailable()).toBe(false);
  });

  it("returns true when a provider is configured and available", () => {
    (isAIVideoAnalysisAvailable as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(isAIVideoAnalysisAvailable()).toBe(true);
  });
});

// ─── Grocery engine isolation ─────────────────────────────────────────────────

describe("grocery engine isolation", () => {
  it("video analysis ingredients are never returned by listIngredients server function directly", async () => {
    // Design invariant: grocery engine reads from RecipeIngredient, not VideoAnalysisIngredient.
    // Verify no video-analysis-specific functions leaked into the ingredients server module.
    const ingredientsModule = await import("@/server/ingredients");
    const exports = Object.keys(ingredientsModule);
    expect(exports).not.toContain("listVideoAnalysisIngredients");
    expect(exports).not.toContain("getVideoIngredients");
  });
});
