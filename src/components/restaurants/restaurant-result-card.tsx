"use client";

import { useState } from "react";
import { MapPin, ExternalLink, BookmarkPlus, BookmarkCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

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
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--color-ink)] truncate">{result.name}</p>
          {result.category && (
            <p className="text-xs text-[var(--color-muted)] capitalize mt-0.5">{result.category}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaved || saving}
          title={isSaved ? "Saved" : "Save this restaurant"}
          className="shrink-0 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition"
        >
          {isSaved ? (
            <BookmarkCheck className="h-5 w-5 text-green-600" />
          ) : (
            <BookmarkPlus className="h-5 w-5 text-[var(--color-muted)]" />
          )}
        </button>
      </div>

      {result.address && (
        <div className="flex items-start gap-1.5 text-sm text-[var(--color-muted)]">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{result.address}</span>
        </div>
      )}

      {result.mapUrl && (
        <a
          href={result.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          View on map <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {saveError && <p className="text-xs text-red-600">{saveError}</p>}
    </Card>
  );
}
