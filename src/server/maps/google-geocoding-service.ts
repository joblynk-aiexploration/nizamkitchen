import { getGoogleGeocodingConfig } from "@/server/maps/google-maps-config";

export type GoogleGeocodedAddress = {
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  rawJson: unknown;
};

function getComponent(components: Array<{ long_name?: string; short_name?: string; types?: string[] }> | undefined, type: string) {
  const match = components?.find((component) => component.types?.includes(type));
  return {
    longName: match?.long_name ?? null,
    shortName: match?.short_name ?? null,
  };
}

export async function geocodeGoogleAddress(params: { address: string; countryCode?: string | null }) {
  const config = await getGoogleGeocodingConfig(params.countryCode);
  if (!config.enabled || !params.address.trim()) {
    return null;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", params.address.trim());
  url.searchParams.set("key", config.apiKey);
  if (params.countryCode?.trim()) {
    url.searchParams.set("components", `country:${params.countryCode.trim().toUpperCase()}`);
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Google geocoding error ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    results?: Array<{
      place_id?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
    }>;
  };
  const result = payload.results?.[0];
  if (!result) return null;

  return {
    formattedAddress: result.formatted_address ?? params.address,
    latitude: result.geometry?.location?.lat ?? null,
    longitude: result.geometry?.location?.lng ?? null,
    placeId: result.place_id ?? null,
    city: getComponent(result.address_components, "locality").longName,
    region: getComponent(result.address_components, "administrative_area_level_1").longName,
    postalCode: getComponent(result.address_components, "postal_code").longName,
    countryCode: getComponent(result.address_components, "country").shortName,
    rawJson: result,
  } satisfies GoogleGeocodedAddress;
}
