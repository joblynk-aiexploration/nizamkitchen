import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalHttpProvider } from "@/server/video-analysis/providers/local-http-provider";

const input = {
  recipeId: "recipe-1",
  recipeTitle: "Bagara Khana",
  recipeIngredients: [{ name: "Rice", quantity: 2, unit: "cups" }],
  recipeStepCount: 1,
  transcriptText: "0:00 Wash rice.",
};

describe("LocalHttpProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns a clean setup message when LOCAL_AI_BASE_URL is missing", async () => {
    vi.stubEnv("AI_VIDEO_ANALYSIS_ENABLED", "true");
    vi.stubEnv("LOCAL_AI_ENABLED", "true");
    vi.stubEnv("LOCAL_AI_BASE_URL", "");

    const result = await new LocalHttpProvider().analyzeFromTranscript(input);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Local AI server is not running.");
  });

  it("rejects invalid local HTTP responses with Zod validation", async () => {
    vi.stubEnv("LOCAL_AI_ENABLED", "true");
    vi.stubEnv("LOCAL_AI_BASE_URL", "http://localhost:8001");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: true }),
    }));

    const result = await new LocalHttpProvider().analyzeFromTranscript(input);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("AI provider returned invalid output.");
  });

  it("returns valid local HTTP analysis output", async () => {
    vi.stubEnv("LOCAL_AI_ENABLED", "true");
    vi.stubEnv("LOCAL_AI_BASE_URL", "http://localhost:8001");
    vi.stubEnv("LOCAL_AI_MODEL", "nizamkitchen-local-v1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Local model analysis",
        summary: "Analyzed by local server.",
        confidence: "medium",
        ingredients: [{ ingredientName: "Rice", quantity: 2, unitName: "cups", confidence: "high" }],
        steps: [{ stepNumber: 1, description: "Wash rice.", confidence: "high" }],
        differencesFromWrittenRecipe: [],
        warnings: [],
      }),
    }));

    const result = await new LocalHttpProvider().analyzeFromTranscript(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.provider).toBe("local_http");
    expect(result.model).toBe("nizamkitchen-local-v1");
    expect(result.output.ingredients[0].ingredientName).toBe("Rice");
  });

  it("handles local HTTP timeout cleanly", async () => {
    vi.stubEnv("LOCAL_AI_ENABLED", "true");
    vi.stubEnv("LOCAL_AI_BASE_URL", "http://localhost:8001");
    vi.stubEnv("LOCAL_AI_TIMEOUT_MS", "1");
    vi.stubGlobal("fetch", vi.fn((_url, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));

    const result = await new LocalHttpProvider().analyzeFromTranscript(input);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Local AI server timed out.");
  });
});
