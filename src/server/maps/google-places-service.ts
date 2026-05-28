import { getGooglePlacesSearchConfig } from "@/server/maps/google-maps-config";

export type GooglePlaceSearchResult = {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  providerPlaceId: string;
  mapUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
  rawJson: unknown;
};

type SearchGooglePlacesParams = {
  query: string;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  limit?: number;
};

type GooglePlacesApiPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryTypeDisplayName?: { text?: string };
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number | string;
  currentOpeningHours?: { openNow?: boolean };
};

function normalizePriceLevel(value: number | string | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/(\d+)/);
    if (match) return Number(match[1]);
  }
  return null;
}
export async function searchGooglePlaces(params: SearchGooglePlacesParams): Promise<GooglePlaceSearchResult[]> {
  const config = await getGooglePlacesSearchConfig(params.countryCode);
  if (!config.enabled) {
    return [];
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.googleMapsUri,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours",
    },
    body: JSON.stringify({
      textQuery: params.query,
      pageSize: Math.min(Math.max(params.limit ?? 10, 1), 10),
      includedType: "restaurant",
      rankPreference: params.latitude != null && params.longitude != null ? "DISTANCE" : "RELEVANCE",
      regionCode: config.regionCode ?? undefined,
      locationBias:
        params.latitude != null && params.longitude != null
          ? {
              circle: {
                center: {
                  latitude: params.latitude,
                  longitude: params.longitude,
                },
                radius: config.defaultRadiusMeters,
              },
            }
          : undefined,
    }),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Google Places search error ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { places?: GooglePlacesApiPlace[] };
  return (payload.places ?? []).map((place) => ({
    name: place.displayName?.text?.trim() || "Unknown place",
    address: place.formattedAddress ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    category: place.primaryTypeDisplayName?.text?.trim() || null,
    providerPlaceId: place.id ?? crypto.randomUUID(),
    mapUrl: place.googleMapsUri ?? null,
    rating: typeof place.rating === "number" ? place.rating : null,
    ratingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    priceLevel: normalizePriceLevel(place.priceLevel),
    openNow:
      typeof place.currentOpeningHours?.openNow === "boolean"
        ? place.currentOpeningHours.openNow
        : null,
    rawJson: place,
  }));
}
