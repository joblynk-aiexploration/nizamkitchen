export type YouTubeDiscoveryConfig =
  | { enabled: false; reason: string }
  | { enabled: true; apiKey: string };

export function getYouTubeDiscoveryConfig(): YouTubeDiscoveryConfig {
  const enabled = process.env.YOUTUBE_DISCOVERY_ENABLED === "true";
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim() ?? "";

  if (!enabled) {
    return { enabled: false, reason: "YOUTUBE_DISCOVERY_ENABLED is not set to true." };
  }
  if (!apiKey) {
    return { enabled: false, reason: "YOUTUBE_DATA_API_KEY is not configured." };
  }
  return { enabled: true, apiKey };
}

export function isYouTubeDiscoveryAvailable(): boolean {
  return getYouTubeDiscoveryConfig().enabled;
}
