"use client";

import { useState } from "react";
import { BookmarkPlus, BookmarkCheck } from "lucide-react";
import { PlaceResultCard } from "@/components/maps/PlaceResultCard";

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
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
};

type Props = {
  result: Result;
  savedPlaceIds: Set<string>;
  onSaved: (placeId: string) => void;
};

export function RestaurantResultCard({ result, savedPlaceIds, onSaved }: Props) {
  const placeKey = result.providerPlaceId ?? result.id;
  const isSaved = savedPlaceIds.has(placeKey);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/restaurants/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.name,
          address: result.address,
          latitude: result.latitude,
          longitude: result.longitude,
          category: result.category,
          mapUrl: result.mapUrl,
          provider: result.provider,
          providerPlaceId: result.providerPlaceId,
        }),
      });
      if (!res.ok) throw new Error("Could not save restaurant.");
      onSaved(placeKey);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlaceResultCard
      name={result.name}
      address={result.address}
      category={result.category}
      mapUrl={result.mapUrl}
      rating={result.rating}
      ratingCount={result.ratingCount}
      priceLevel={result.priceLevel}
      openNow={result.openNow}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaved || saving}
            title={isSaved ? "Saved" : "Save this restaurant"}
            aria-label={isSaved ? "Restaurant saved" : "Save this restaurant"}
            className="shrink-0 rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-slate-100 hover:text-[var(--text-primary)] disabled:text-slate-500"
          >
            {isSaved ? (
              <BookmarkCheck className="h-5 w-5 text-green-600" />
            ) : (
              <BookmarkPlus className="h-5 w-5 text-[var(--color-muted)]" />
            )}
          </button>
          {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}
        </div>
      )}
    />
  );
}
