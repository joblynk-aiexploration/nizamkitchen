// Placeholder — Local vision model provider not yet implemented
// Configure by setting: AI_PROVIDER=local_vision, LOCAL_VISION_MODEL_ENABLED=true
import type { VideoAnalysisProvider, AnalyzeVideoInput, AnalyzeVideoResult } from "./types";

export class LocalVisionProvider implements VideoAnalysisProvider {
  readonly name = "local_vision";
  readonly isAvailable = false;

  async analyzeFromTranscript(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return { success: false, error: "Local vision provider not yet implemented.", provider: this.name };
  }

  async analyzeFromFrames(_input: AnalyzeVideoInput): Promise<AnalyzeVideoResult> {
    return { success: false, error: "Local vision provider not yet implemented.", provider: this.name };
  }
}
