// Placeholder — Gemini provider not yet implemented
// Configure by setting: AI_PROVIDER=gemini, GEMINI_API_KEY=...
import type { VideoAnalysisProvider, AnalyzeVideoInput, AnalyzeVideoResult } from "./types";

export class GeminiProvider implements VideoAnalysisProvider {
  readonly name = "gemini";
  readonly isAvailable = false;

  async analyzeFromTranscript(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return { success: false, error: "Gemini provider not yet implemented.", provider: this.name };
  }

  async analyzeFromFrames(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return { success: false, error: "Gemini provider not yet implemented.", provider: this.name };
  }
}
