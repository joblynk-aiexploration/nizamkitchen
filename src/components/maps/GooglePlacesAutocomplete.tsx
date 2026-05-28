"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMapsApi, normalizeGoogleAutocompletePlace, type NormalizedGooglePlaceSelection } from "@/lib/google-maps";

type Props = {
  browserApiKey?: string | null;
  placeholder?: string;
  defaultValue?: string;
  disabledReason?: string | null;
  countryCodes?: string[];
  types?: string[];
  onPlaceSelected?: (place: NormalizedGooglePlaceSelection) => void;
};

export function GooglePlacesAutocomplete({
  browserApiKey,
  placeholder = "Search for a place",
  defaultValue = "",
  disabledReason,
  countryCodes = [],
  types = ["address"],
  onPlaceSelected,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!browserApiKey || !inputRef.current) return;

    let listener: { remove: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      const google = await loadGoogleMapsApi({
        apiKey: browserApiKey,
        libraries: ["places"],
      });
      if (cancelled || !inputRef.current) return;

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        fields: [
          "address_components",
          "formatted_address",
          "geometry",
          "name",
          "place_id",
          "url",
        ],
        componentRestrictions: countryCodes.length > 0 ? { country: countryCodes.map((code) => code.toLowerCase()) } : undefined,
        types,
      });

      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        onPlaceSelected?.(normalizeGoogleAutocompletePlace(place));
      });
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [browserApiKey, countryCodes, onPlaceSelected, types]);

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-ink)]">
      <span>Search with Google Places</span>
      <input
        ref={inputRef}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={!browserApiKey}
        className="rounded-2xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 disabled:bg-slate-100"
      />
      {!browserApiKey && disabledReason ? (
        <span className="text-xs font-normal text-[var(--color-muted)]">{disabledReason}</span>
      ) : null}
    </label>
  );
}
