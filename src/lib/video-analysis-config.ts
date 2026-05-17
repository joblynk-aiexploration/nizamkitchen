export type AIProviderName = "disabled" | "mock" | "openai" | "anthropic" | "gemini" | "local_vision";

export type VideoAnalysisConfig = {
  enabled: boolean;
  provider: AIProviderName;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  geminiApiKey: string | null;
  localVisionEnabled: boolean;
};

// Read AI config from env — all optional, never required for build/start
export function getVideoAnalysisConfig(): VideoAnalysisConfig {
  const enabled = process.env.AI_VIDEO_ANALYSIS_ENABLED === "true";
  const rawProvider = process.env.AI_PROVIDER ?? "disabled";

  const provider: AIProviderName =
    rawProvider === "openai" ||
    rawProvider === "anthropic" ||
    rawProvider === "gemini" ||
    rawProvider === "local_vision" ||
    rawProvider === "mock"
      ? rawProvider
      : "disabled";

  return {
    enabled,
    provider: enabled ? provider : "disabled",
    openaiApiKey: process.env.OPENAI_API_KEY ?? null,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? null,
    geminiApiKey: process.env.GEMINI_API_KEY ?? null,
    localVisionEnabled: process.env.LOCAL_VISION_MODEL_ENABLED === "true",
  };
}

export function isAIVideoAnalysisAvailable(): boolean {
  const cfg = getVideoAnalysisConfig();
  if (!cfg.enabled) return false;
  if (cfg.provider === "disabled") return false;
  if (cfg.provider === "openai" && !cfg.openaiApiKey) return false;
  if (cfg.provider === "anthropic" && !cfg.anthropicApiKey) return false;
  if (cfg.provider === "gemini" && !cfg.geminiApiKey) return false;
  return true;
}
