// Placeholder — OpenAI provider not yet implemented
// Configure by setting: AI_PROVIDER=openai, OPENAI_API_KEY=sk-...
import type { VideoAnalysisProvider, AnalyzeVideoInput, AnalyzeVideoResult } from "./types";

export class OpenAIProvider implements VideoAnalysisProvider {
  readonly name = "openai";
  readonly isAvailable = false;

  async analyzeFromTranscript(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return { success: false, error: "OpenAI provider not yet implemented.", provider: this.name };
  }

  async analyzeFromFrames(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return { success: false, error: "OpenAI provider not yet implemented.", provider: this.name };
  }
}
