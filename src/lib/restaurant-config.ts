export function getRestaurantConfig() {
  const apiKey = process.env.MAPTILER_API_KEY ?? "";
  const enabled = process.env.MAPTILER_RESTAURANT_DISCOVERY_ENABLED === "true";
  return { apiKey, enabled };
}

export function isRestaurantDiscoveryAvailable(): boolean {
  const { apiKey, enabled } = getRestaurantConfig();
  return enabled && apiKey.length > 0;
}
