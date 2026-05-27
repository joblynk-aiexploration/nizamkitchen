import { IntegrationProvider } from "@prisma/client";
import { getActiveIntegration, getPublicIntegrationConfig } from "@/server/config/platform-config-service";

type MapCenter = {
  lat: number;
  lng: number;
};

type GoogleMapsDisabledConfig = {
  enabled: false;
  reason: string;
  browserApiKey: null;
  allowedCountries: string[];
  defaultCountry: string | null;
  defaultMapCenter: MapCenter;
  defaultRadiusMeters: number;
  autocompleteEnabled: false;
  placesSearchEnabled: boolean;
  locationTrackingEnabled: boolean;
};

type GoogleMapsEnabledConfig = {
  enabled: true;
  reason: null;
  browserApiKey: string;
  allowedCountries: string[];
  defaultCountry: string | null;
  defaultMapCenter: MapCenter;
  defaultRadiusMeters: number;
  autocompleteEnabled: boolean;
  placesSearchEnabled: boolean;
  locationTrackingEnabled: boolean;
};

export type GoogleMapsPublicConfig = GoogleMapsDisabledConfig | GoogleMapsEnabledConfig;

export type GooglePlacesSearchConfig =
  | {
      enabled: false;
      reason: string;
      apiKey: null;
      defaultRadiusMeters: number;
      regionCode: string | null;
    }
  | {
      enabled: true;
      reason: null;
      apiKey: string;
      defaultRadiusMeters: number;
      regionCode: string | null;
    };

export type GoogleGeocodingConfig =
  | {
      enabled: false;
      reason: string;
      apiKey: null;
    }
  | {
      enabled: true;
      reason: null;
      apiKey: string;
    };

const DEFAULT_MAP_CENTER: MapCenter = { lat: 17.385, lng: 78.4867 };
const DEFAULT_RADIUS_METERS = 5000;
const MAPS_UNAVAILABLE_MESSAGE =
  "Map features are temporarily unavailable. You can still enter the address manually.";
const PLACES_UNAVAILABLE_MESSAGE =
  "Restaurant search is temporarily unavailable. You can still enter restaurant details manually or try again later.";

function normalizeCountryCode(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
function parseBooleanSetting(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function parseNumberSetting(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseStringSetting(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseArraySetting(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim().toUpperCase() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean);
  }
  return [] as string[];
}

function parseMapCenter(value: unknown) {
  if (!value || typeof value !== "object") return DEFAULT_MAP_CENTER;
  const candidate = value as { lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown };
  const lat = typeof candidate.lat === "number" ? candidate.lat : typeof candidate.latitude === "number" ? candidate.latitude : null;
  const lng = typeof candidate.lng === "number" ? candidate.lng : typeof candidate.longitude === "number" ? candidate.longitude : null;
  if (lat == null || lng == null) return DEFAULT_MAP_CENTER;
  return { lat, lng };
}

function settingsToRecord(settings: Array<{ settingKey: string; settingValueJson: unknown }> | undefined) {
  return Object.fromEntries((settings ?? []).map((setting) => [setting.settingKey, setting.settingValueJson]));
}

function credentialValue(
  credentials: Array<{ keyName: string; value?: string }> | Array<{ keyName: string; encryptedValue?: string }> | undefined,
  keyName: string,
) {
  const credential = credentials?.find((entry) => entry.keyName === keyName) as { value?: string } | undefined;
  return credential?.value?.trim() ?? "";
}

export async function getGoogleMapsPublicConfig(countryCode?: string | null): Promise<GoogleMapsPublicConfig> {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const [mapsIntegration, mapsPublicConfig] = await Promise.all([
    getActiveIntegration(IntegrationProvider.google_maps, normalizedCountryCode).catch(() => null),
    getPublicIntegrationConfig(IntegrationProvider.google_maps, normalizedCountryCode).catch(() => null),
  ]);

  const settings = settingsToRecord(mapsIntegration?.settings);
  const browserApiKey =
    mapsPublicConfig?.credentials.browser_api_key?.trim() ||
    process.env.GOOGLE_MAPS_BROWSER_API_KEY?.trim() ||
    "";
  const allowedCountries = parseArraySetting(settings.allowedCountries);
  const defaultCountry = normalizeCountryCode(
    parseStringSetting(settings.defaultCountry) ?? normalizedCountryCode ?? process.env.DEFAULT_COUNTRY_CODE,
  );
  const defaultMapCenter = parseMapCenter(settings.defaultMapCenter);
  const defaultRadiusMeters = parseNumberSetting(settings.defaultRadiusMeters, DEFAULT_RADIUS_METERS);
  const autocompleteEnabled = parseBooleanSetting(settings.autocompleteEnabled, true);
  const placesSearchEnabled = parseBooleanSetting(settings.placesSearchEnabled, true);
  const locationTrackingEnabled = parseBooleanSetting(settings.locationTrackingEnabled, false);

  if (!browserApiKey) {
    return {
      enabled: false,
      reason: MAPS_UNAVAILABLE_MESSAGE,
      browserApiKey: null,
      allowedCountries,
      defaultCountry,
      defaultMapCenter,
      defaultRadiusMeters,
      autocompleteEnabled: false,
      placesSearchEnabled,
      locationTrackingEnabled,
    };
  }

  return {
    enabled: true,
    reason: null,
    browserApiKey,
    allowedCountries,
    defaultCountry,
    defaultMapCenter,
    defaultRadiusMeters,
    autocompleteEnabled,
    placesSearchEnabled,
    locationTrackingEnabled,
  };
}

export async function getGooglePlacesSearchConfig(countryCode?: string | null): Promise<GooglePlacesSearchConfig> {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const [mapsIntegration, placesIntegration] = await Promise.all([
    getActiveIntegration(IntegrationProvider.google_maps, normalizedCountryCode).catch(() => null),
    getActiveIntegration(IntegrationProvider.google_places, normalizedCountryCode).catch(() => null),
  ]);

  const mapsSettings = settingsToRecord(mapsIntegration?.settings);
  const placesSettings = settingsToRecord(placesIntegration?.settings);
  const apiKey =
    credentialValue(placesIntegration?.credentials, "server_api_key") ||
    credentialValue(mapsIntegration?.credentials, "server_api_key") ||
    process.env.GOOGLE_PLACES_SERVER_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ||
    "";
  const defaultRadiusMeters = parseNumberSetting(mapsSettings.defaultRadiusMeters, DEFAULT_RADIUS_METERS);
  const placesSearchEnabled = parseBooleanSetting(
    placesSettings.placesSearchEnabled ?? mapsSettings.placesSearchEnabled,
    true,
  );

  if (!placesSearchEnabled) {
    return {
      enabled: false,
      reason: PLACES_UNAVAILABLE_MESSAGE,
      apiKey: null,
      defaultRadiusMeters,
      regionCode: normalizedCountryCode,
    };
  }

  if (!apiKey) {
    return {
      enabled: false,
      reason: PLACES_UNAVAILABLE_MESSAGE,
      apiKey: null,
      defaultRadiusMeters,
      regionCode: normalizedCountryCode,
    };
  }

  return {
    enabled: true,
    reason: null,
    apiKey,
    defaultRadiusMeters,
    regionCode: normalizedCountryCode,
  };
}

export async function getGoogleGeocodingConfig(countryCode?: string | null): Promise<GoogleGeocodingConfig> {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const [mapsIntegration, geocodingIntegration] = await Promise.all([
    getActiveIntegration(IntegrationProvider.google_maps, normalizedCountryCode).catch(() => null),
    getActiveIntegration(IntegrationProvider.google_geocoding, normalizedCountryCode).catch(() => null),
  ]);

  const apiKey =
    credentialValue(geocodingIntegration?.credentials, "server_api_key") ||
    credentialValue(mapsIntegration?.credentials, "server_api_key") ||
    process.env.GOOGLE_GEOCODING_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ||
    "";

  if (!apiKey) {
    return {
      enabled: false,
      reason: MAPS_UNAVAILABLE_MESSAGE,
      apiKey: null,
    };
  }

  return {
    enabled: true,
    reason: null,
    apiKey,
  };
}

export async function isGooglePlacesSearchAvailable(countryCode?: string | null) {
  return (await getGooglePlacesSearchConfig(countryCode)).enabled;
}
