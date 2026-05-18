import { getRestaurantConfig } from "@/lib/restaurant-config";

export type MapTilerFeature = {
  id: string;
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  properties: {
    name?: string;
    place_type?: string[];
    category?: string;
    address?: string;
    place_name?: string;
    country_code?: string;
    [key: string]: unknown;
  };
};

export type MapTilerSearchResult = {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  providerPlaceId: string;
  mapUrl: string | null;
  rawJson: MapTilerFeature;
};

const MAPTILER_GEOCODING_BASE = "https://api.maptiler.com/geocoding";

export async function searchMapTilerPlaces(params: {
  query: string;
  latitude?: number | null;
  longitude?: number | null;
  limit?: number;
}): Promise<MapTilerSearchResult[]> {
  const { apiKey } = getRestaurantConfig();
  if (!apiKey) return [];

  const encoded = encodeURIComponent(params.query.trim());
  const url = new URL(`${MAPTILER_GEOCODING_BASE}/${encoded}.json`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("types", "poi");
  url.searchParams.set("limit", String(params.limit ?? 10));
  url.searchParams.set("language", "en");

  if (params.latitude != null && params.longitude != null) {
    url.searchParams.set("proximity", `${params.longitude},${params.latitude}`);
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MapTiler geocoding error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { features?: MapTilerFeature[] };
  const features = data.features ?? [];

  return features.map((f) => {
    const coords = f.geometry?.coordinates ?? null;
    const props = f.properties ?? {};
    const placeName = props.place_name ?? props.name ?? "";
    const name = props.name ?? placeName.split(",")[0] ?? "Unknown place";

    // MapTiler map link uses the place_name for a search URL
    const mapUrl = placeName
      ? `https://www.maptiler.com/maps/#${encodeURIComponent(placeName)}`
      : null;

    return {
      name,
      address: props.address ?? (placeName !== name ? placeName : null) ?? null,
      latitude: coords ? coords[1] : null,
      longitude: coords ? coords[0] : null,
      category: props.category ?? (props.place_type ? String(props.place_type[0] ?? "") : null) ?? null,
      providerPlaceId: String(f.id ?? `${name}-${coords?.[0]}-${coords?.[1]}`),
      mapUrl,
      rawJson: f,
    };
  });
}
