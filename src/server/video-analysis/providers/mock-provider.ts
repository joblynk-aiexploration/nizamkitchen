import type { VideoAnalysisProvider, AnalyzeVideoInput, AnalyzeVideoResult } from "./types";
import type { AIProviderOutput } from "@/lib/validation/video";

// Used only in tests — never returned in production UI
export class MockProvider implements VideoAnalysisProvider {
  readonly name = "mock";
  readonly isAvailable = true;

  async analyzeFromTranscript(input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    const output: AIProviderOutput = {
      title: `AI analysis of ${input.videoTitle ?? input.recipeTitle}`,
      summary: "Mock analysis generated for testing. This is not real AI output.",
      confidence: "low",
      ingredients: input.recipeIngredients.slice(0, 3).map((ri, i) => ({
        ingredientName: ri.name,
        quantity: null,
        unitName: null,
        preparationNote: null,
        timestampStartSeconds: i * 30,
        timestampEndSeconds: i * 30 + 10,
        confidence: "low" as const,
        evidenceText: "Mock evidence from transcript",
        notes: "Mock ingredient — not real analysis",
      })),
      steps: [
        {
          stepNumber: 1,
          title: "Mock step",
          description: "This is a mock cooking step generated for testing.",
          timestampStartSeconds: 0,
          timestampEndSeconds: 60,
          durationSeconds: 60,
          temperature: null,
          technique: null,
          confidence: "low" as const,
          evidenceText: null,
          notes: "Mock data — not real analysis",
        },
      ],
      differencesFromWrittenRecipe: [],
      warnings: ["This is mock analysis data generated for testing purposes only."],
    };

    return {
      success: true,
      output,
      provider: this.name,
      model: "mock-v1",
      costCents: 0,
    };
  }

  async analyzeFromFrames(input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return this.analyzeFromTranscript(input);
  }
}
