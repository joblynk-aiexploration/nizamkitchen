import { aiProviderOutputSchema } from "@/lib/validation/video";
import { getVideoAnalysisConfig } from "@/lib/video-analysis-config";
import type { AnalyzeVideoInput, AnalyzeVideoResult, VideoAnalysisProvider } from "./types";
import { ZodError } from "zod";

export class LocalHttpProvider implements VideoAnalysisProvider {
  readonly name = "local_http";

  get isAvailable() {
    const cfg = getVideoAnalysisConfig();
    return cfg.localAiEnabled && !!cfg.localAiBaseUrl;
  }

  async analyzeFromTranscript(input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    const cfg = getVideoAnalysisConfig();
    if (!cfg.localAiBaseUrl) {
      return { success: false, error: "Local AI server is not running.", provider: this.name };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.localAiTimeoutMs);

    try {
      const response = await fetch(`${cfg.localAiBaseUrl.replace(/\/$/, "")}/analyze-cooking-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          recipeName: input.recipeTitle,
          cuisine: input.recipeCuisine ?? null,
          countryCode: input.recipeCountryCode ?? null,
          writtenRecipeIngredients: input.recipeIngredients,
          transcript: input.transcriptText ?? "",
          videoMetadata: {
            title: input.videoTitle ?? null,
            language: input.videoLanguage ?? null,
          },
          promptVersion: "cooking-video-analysis-v1",
          model: cfg.localAiModel,
        }),
      });

      if (!response.ok) {
        console.error("Local AI server returned an error", { status: response.status, statusText: response.statusText });
        return { success: false, error: "Local AI server returned an error.", provider: this.name };
      }

      const json = await response.json() as unknown;
      const output = aiProviderOutputSchema.parse(json);
      return {
        success: true,
        output,
        provider: this.name,
        model: cfg.localAiModel ?? "local-http",
        costCents: 0,
      };
    } catch (error) {
      const message = error instanceof ZodError
        ? "AI provider returned invalid output."
        : error instanceof Error && error.name === "AbortError"
          ? "Local AI server timed out."
          : "Local AI server is not running.";
      console.error("Local AI analysis failed", error);
      return { success: false, error: message, provider: this.name };
    } finally {
      clearTimeout(timeout);
    }
  }

  async analyzeFromFrames(input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return this.analyzeFromTranscript(input);
  }
}
