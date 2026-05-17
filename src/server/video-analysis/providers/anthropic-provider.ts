// Placeholder — Anthropic provider not yet implemented
// Configure by setting: AI_PROVIDER=anthropic, ANTHROPIC_API_KEY=sk-ant-...
import type { VideoAnalysisProvider, AnalyzeVideoInput, AnalyzeVideoResult } from "./types";

export class AnthropicProvider implements VideoAnalysisProvider {
  readonly name = "anthropic";
  readonly isAvailable = false;

  async analyzeFromTranscript(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return { success: false, error: "Anthropic provider not yet implemented.", provider: this.name };
  }

  async analyzeFromFrames(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return { success: false, error: "Anthropic provider not yet implemented.", provider: this.name };
  }
}
