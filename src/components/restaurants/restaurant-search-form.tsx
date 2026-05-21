"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { GooglePlacesAutocomplete } from "@/components/maps/GooglePlacesAutocomplete";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import type { GoogleMapsPublicConfig } from "@/server/maps/google-maps-config";
import type { NormalizedGooglePlaceSelection } from "@/lib/google-maps";

type Props = {
  defaultQuery?: string;
  defaultCity?: string;
  defaultRecipeId?: string;
  mapsConfig: GoogleMapsPublicConfig;
};

export function RestaurantSearchForm({
  defaultQuery = "",
  defaultCity = "",
  defaultRecipeId,
  mapsConfig,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [city, setCity] = useState(defaultCity);
  const [region, setRegion] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedCountries =
    mapsConfig.allowedCountries.length > 0
      ? mapsConfig.allowedCountries
      : mapsConfig.defaultCountry
        ? [mapsConfig.defaultCountry]
        : [];

  const handlePlaceSelected = useCallback((place: NormalizedGooglePlaceSelection) => {
    setCity(place.city ?? "");
    setRegion(place.region ?? "");
    setLatitude(place.latitude != null ? String(place.latitude) : "");
    setLongitude(place.longitude != null ? String(place.longitude) : "");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = { query: query.trim() };
      if (city.trim()) body.city = city.trim();
      if (region.trim()) body.region = region.trim();
      if (latitude.trim()) body.latitude = latitude.trim();
      if (longitude.trim()) body.longitude = longitude.trim();
      if (defaultRecipeId) body.recipeId = defaultRecipeId;

      const res = await fetch("/api/restaurants/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Search failed.");
      }

      const { searchId } = (await res.json()) as { searchId: string };
      router.push(`/order-instead/searches/${searchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput
        label="What are you looking for?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Hyderabadi biryani, haleem, kebabs…"
        required
        maxLength={200}
      />
      <GooglePlacesAutocomplete
        browserApiKey={mapsConfig.enabled ? mapsConfig.browserApiKey : null}
        disabledReason={mapsConfig.enabled ? null : mapsConfig.reason}
        placeholder="Bias results near a city or neighborhood"
        defaultValue={defaultCity}
        countryCodes={allowedCountries}
        types={["(cities)"]}
        onPlaceSelected={handlePlaceSelected}
      />
      <TextInput
        label="City (optional)"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Hyderabad, London, Houston…"
        maxLength={100}
      />
      <input type="hidden" value={region} name="region" />
      <input type="hidden" value={latitude} name="latitude" />
      <input type="hidden" value={longitude} name="longitude" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading || !query.trim()}>
        {loading ? "Searching…" : "Find Restaurants"}
      </Button>
    </form>
  );
}
