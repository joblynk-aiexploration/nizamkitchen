import type { VideoAnalysisProvider, AnalyzeVideoInput, AnalyzeVideoResult } from "./types";

export class DisabledProvider implements VideoAnalysisProvider {
  readonly name = "disabled";
  readonly isAvailable = false;

  async analyzeFromTranscript(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return {
      success: false,
      error: "AI video analysis is not configured. Set AI_VIDEO_ANALYSIS_ENABLED=true and configure an AI provider.",
      provider: this.name,
    };
  }

  async analyzeFromFrames(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return this.analyzeFromTranscript(_input);
  }
}
