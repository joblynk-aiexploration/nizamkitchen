"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadGoogleMapsApi,
  type GoogleMapInstance,
  type GoogleMarkerInstance,
} from "@/lib/google-maps";

type Marker = {
  latitude: number;
  longitude: number;
  name: string;
  address?: string | null;
};

type Props = {
  browserApiKey?: string | null;
  markers: Marker[];
  center?: { latitude: number; longitude: number };
  className?: string;
};

export function GoogleMap({ browserApiKey, markers, center, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !browserApiKey) return;

    let map: GoogleMapInstance | null = null;
    const activeMarkers: GoogleMarkerInstance[] = [];
    let cancelled = false;

    void (async () => {
      try {
        const google = await loadGoogleMapsApi({
          apiKey: browserApiKey,
          libraries: ["maps"],
        });
        if (cancelled || !containerRef.current) return;

        const validMarkers = markers.filter((marker) => marker.latitude != null && marker.longitude != null);
        const defaultCenter =
          center ??
          (validMarkers.length > 0
            ? { latitude: validMarkers[0].latitude, longitude: validMarkers[0].longitude }
            : { latitude: 17.385, longitude: 78.4867 });

        map = new google.maps.Map(containerRef.current, {
          center: { lat: defaultCenter.latitude, lng: defaultCenter.longitude },
          zoom: validMarkers.length === 1 ? 14 : 12,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        const bounds = new google.maps.LatLngBounds();
        for (const marker of validMarkers) {
          const pin = new google.maps.Marker({
            map,
            position: { lat: marker.latitude, lng: marker.longitude },
            title: marker.name,
          });
          const infoWindow = new google.maps.InfoWindow({
            content: `<div><strong>${marker.name}</strong>${marker.address ? `<br/>${marker.address}` : ""}</div>`,
          });
          pin.addListener("click", () => infoWindow.open({ anchor: pin, map }));
          activeMarkers.push(pin);
          bounds.extend({ lat: marker.latitude, lng: marker.longitude });
        }

        if (validMarkers.length > 1) {
          map.fitBounds(bounds, 60);
        }

        setLoadError(null);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Google Maps failed to load.");
      }
    })();

    return () => {
      cancelled = true;
      for (const marker of activeMarkers) {
        marker.setMap?.(null);
      }
      if (map) {
        map = null;
      }
    };
  }, [browserApiKey, center, markers]);

  if (!browserApiKey) {
    return (
      <div className={className ?? "rounded-lg border border-[var(--color-border)] bg-slate-50 p-4 text-sm text-[var(--color-muted)]"}>
        Map preview is temporarily unavailable. You can still use the address details on this page.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={className ?? "h-64 w-full rounded-lg border border-[var(--color-border)]"}
      />
      {loadError ? <p className="text-xs text-amber-700">{loadError}</p> : null}
    </div>
  );
}
