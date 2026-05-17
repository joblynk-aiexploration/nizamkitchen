import type { VideoAnalysisProvider, AnalyzeVideoInput } from "./providers/types";

export async function analyzeFrames(
  provider: VideoAnalysisProvider,
  input: AnalyzeVideoInput,
): Promise<ReturnType<VideoAnalysisProvider["analyzeFromFrames"]>> {
  if (!provider.isAvailable) {
    return { success: false, error: "AI provider is not available.", provider: provider.name };
  }
  if (!input.frameTimestamps?.length) {
    return { success: false, error: "No frames provided for analysis.", provider: provider.name };
  }
  return provider.analyzeFromFrames(input);
}
