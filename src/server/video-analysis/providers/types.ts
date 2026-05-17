import type { AIProviderOutput } from "@/lib/validation/video";

export type AnalyzeVideoInput = {
  recipeId: string;
  recipeTitle: string;
  recipeIngredients: Array<{ name: string; quantity: number; unit: string }>;
  recipeStepCount: number;
  transcriptText?: string | null;
  frameTimestamps?: number[] | null;
  videoTitle?: string | null;
  videoLanguage?: string | null;
};

export type AnalyzeVideoResult =
  | { success: true; output: AIProviderOutput; provider: string; model: string | null; costCents: number | null }
  | { success: false; error: string; provider: string };

export interface VideoAnalysisProvider {
  readonly name: string;
  readonly isAvailable: boolean;
  analyzeFromTranscript(input: AnalyzeVideoInput): Promise<AnalyzeVideoResult>;
  analyzeFromFrames(input: AnalyzeVideoInput): Promise<AnalyzeVideoResult>;
}
