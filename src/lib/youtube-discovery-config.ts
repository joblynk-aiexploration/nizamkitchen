import { IntegrationProvider } from "@prisma/client";
import { getActiveIntegration } from "@/server/config/platform-config-service";

export type YouTubeDiscoveryConfig =
  | { enabled: false; reason: string }
  | { enabled: true; apiKey: string };

export async function getYouTubeDiscoveryConfig(): Promise<YouTubeDiscoveryConfig> {
  const integration = await getActiveIntegration(IntegrationProvider.youtube_data).catch(() => null);
  const integrationSettings = integration
    ? Object.fromEntries(integration.settings.map((setting) => [setting.settingKey, setting.settingValueJson]))
    : {};
  const integrationApiKey = integration?.credentials.find((credential) => credential.keyName === "server_api_key")?.value?.trim() ?? "";
  const integrationEnabled = integrationSettings.discoveryEnabled === true || integrationSettings.discoveryEnabled === "true";

  if (integration && integrationEnabled && integrationApiKey) {
    return { enabled: true, apiKey: integrationApiKey };
  }

  const envEnabled = process.env.YOUTUBE_DISCOVERY_ENABLED === "true";
  const envApiKey = process.env.YOUTUBE_DATA_API_KEY?.trim() ?? "";

  if (integration && !integrationEnabled) {
    return {
      enabled: false,
      reason: "YouTube discovery is disabled in the platform configuration vault. Enable the discovery setting to run provider-backed discovery.",
    };
  }

  if (!envEnabled) {
    return { enabled: false, reason: "YouTube discovery is disabled. Enable it in the configuration vault or set YOUTUBE_DISCOVERY_ENABLED=true." };
  }
  if (!envApiKey) {
    return { enabled: false, reason: "YouTube discovery is not configured. Add a vault credential or set YOUTUBE_DATA_API_KEY to enable video discovery." };
  }
  return { enabled: true, apiKey: envApiKey };
}

export async function isYouTubeDiscoveryAvailable(): Promise<boolean> {
  return (await getYouTubeDiscoveryConfig()).enabled;
}
