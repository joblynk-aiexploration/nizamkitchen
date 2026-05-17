export type AIProviderName = "disabled" | "mock" | "local_rules" | "local_http" | "openai" | "anthropic" | "gemini" | "local_vision";

export type VideoAnalysisConfig = {
  enabled: boolean;
  provider: AIProviderName;
  openaiApiKey: string | null;
  anthropicApiKey: string | null;
  geminiApiKey: string | null;
  localVisionEnabled: boolean;
  localAiEnabled: boolean;
  localTranscriptAnalyzerEnabled: boolean;
  localAiBaseUrl: string | null;
  localAiModel: string | null;
  localAiTimeoutMs: number;
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
    rawProvider === "local_rules" ||
    rawProvider === "local_http" ||
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
    localAiEnabled: process.env.LOCAL_AI_ENABLED === "true",
    localTranscriptAnalyzerEnabled: process.env.LOCAL_TRANSCRIPT_ANALYZER_ENABLED !== "false",
    localAiBaseUrl: process.env.LOCAL_AI_BASE_URL || null,
    localAiModel: process.env.LOCAL_AI_MODEL || null,
    localAiTimeoutMs: Number(process.env.LOCAL_AI_TIMEOUT_MS ?? 30000),
  };
}

export function isAIVideoAnalysisAvailable(): boolean {
  const cfg = getVideoAnalysisConfig();
  if (!cfg.enabled) return false;
  if (cfg.provider === "disabled") return false;
  if (cfg.provider === "openai" && !cfg.openaiApiKey) return false;
  if (cfg.provider === "anthropic" && !cfg.anthropicApiKey) return false;
  if (cfg.provider === "gemini" && !cfg.geminiApiKey) return false;
  if (cfg.provider === "local_rules") return cfg.localAiEnabled && cfg.localTranscriptAnalyzerEnabled;
  if (cfg.provider === "local_http") return cfg.localAiEnabled && !!cfg.localAiBaseUrl;
  return true;
}

export function getLocalAIStatus() {
  const cfg = getVideoAnalysisConfig();
  return {
    enabled: cfg.localAiEnabled,
    provider: cfg.provider,
    transcriptAnalyzerEnabled: cfg.localTranscriptAnalyzerEnabled,
    localRulesReady: cfg.localAiEnabled && cfg.localTranscriptAnalyzerEnabled,
    localHttpConfigured: cfg.localAiEnabled && !!cfg.localAiBaseUrl,
    localAiBaseUrl: cfg.localAiBaseUrl,
    localAiModel: cfg.localAiModel,
    timeoutMs: cfg.localAiTimeoutMs,
  };
}
