import type { VideoAnalysisProvider, AnalyzeVideoInput } from "./providers/types";
import { buildTranscriptAnalysisPrompt } from "./prompt-builder";

// Separates prompt building from provider calls for testability
export async function analyzeTranscript(
  provider: VideoAnalysisProvider,
  input: AnalyzeVideoInput,
): Promise<ReturnType<VideoAnalysisProvider["analyzeFromTranscript"]>> {
  if (!provider.isAvailable) {
    return { success: false, error: "AI provider is not available.", provider: provider.name };
  }
  if (!input.transcriptText?.trim()) {
    return { success: false, error: "No transcript text provided.", provider: provider.name };
  }
  // Inject the formatted prompt into transcriptText before calling provider
  const promptedInput: AnalyzeVideoInput = {
    ...input,
    transcriptText: buildTranscriptAnalysisPrompt(input),
  };
  return provider.analyzeFromTranscript(promptedInput);
}
