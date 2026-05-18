"use client";

import { useState } from "react";
import { MapView } from "@/components/restaurants/map-view";
import { RestaurantResultCard } from "@/components/restaurants/restaurant-result-card";

type Result = {
  id: string;
  name: string;
  address: string | null;
  category: string | null;
  mapUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  provider: string;
  providerPlaceId: string | null;
};

type Props = {
  results: Result[];
};

export function SearchResultsClient({ results }: Props) {
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(new Set());

  function onSaved(placeId: string) {
    setSavedPlaceIds((prev) => new Set([...prev, placeId]));
  }

  const mapMarkers = results
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      latitude: r.latitude!,
      longitude: r.longitude!,
      name: r.name,
      address: r.address,
    }));

  return (
    <div className="space-y-6">
      {mapMarkers.length > 0 && (
        <MapView markers={mapMarkers} className="h-72 w-full rounded-xl border border-[var(--color-border)]" />
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--color-ink)]">{results.length} result{results.length !== 1 ? "s" : ""}</p>
        {results.map((r) => (
          <RestaurantResultCard
            key={r.id}
            result={r}
            savedPlaceIds={savedPlaceIds}
            onSaved={onSaved}
          />
        ))}
      </div>
    </div>
  );
}
