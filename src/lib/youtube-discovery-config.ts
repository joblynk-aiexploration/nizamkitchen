export type YouTubeDiscoveryConfig =
  | { enabled: false; reason: string }
  | { enabled: true; apiKey: string };

export function getYouTubeDiscoveryConfig(): YouTubeDiscoveryConfig {
  const enabled = process.env.YOUTUBE_DISCOVERY_ENABLED === "true";
  const apiKey = process.env.YOUTUBE_DATA_API_KEY?.trim() ?? "";

  if (!enabled) {
    return { enabled: false, reason: "YouTube discovery is disabled. Set YOUTUBE_DISCOVERY_ENABLED=true to enable video discovery." };
  }
  if (!apiKey) {
    return { enabled: false, reason: "YouTube discovery is not configured. Add YOUTUBE_DATA_API_KEY to enable video discovery." };
  }
  return { enabled: true, apiKey };
}

export function isYouTubeDiscoveryAvailable(): boolean {
  return getYouTubeDiscoveryConfig().enabled;
}
