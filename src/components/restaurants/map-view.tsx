"use client";

import { useEffect, useRef } from "react";

type Marker = {
  latitude: number;
  longitude: number;
  name: string;
  address?: string | null;
};

type MapViewProps = {
  markers: Marker[];
  center?: { latitude: number; longitude: number };
  className?: string;
};

export function MapView({ markers, center, className }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    if (!apiKey) return;

    let map: import("maplibre-gl").Map | null = null;

    import("maplibre-gl").then(({ Map, Marker: MLMarker, Popup, NavigationControl }) => {
      if (!containerRef.current) return;

      const validMarkers = markers.filter(
        (m) => m.latitude != null && m.longitude != null,
      );

      const defaultCenter =
        center ??
        (validMarkers.length > 0
          ? { latitude: validMarkers[0].latitude, longitude: validMarkers[0].longitude }
          : { latitude: 17.385, longitude: 78.4867 }); // Hyderabad

      map = new Map({
        container: containerRef.current,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
        center: [defaultCenter.longitude, defaultCenter.latitude],
        zoom: validMarkers.length === 1 ? 14 : 12,
      });

      map.addControl(new NavigationControl(), "top-right");

      for (const m of validMarkers) {
        const popup = new Popup({ offset: 25 }).setHTML(
          `<strong class="text-sm">${m.name}</strong>${m.address ? `<br/><span class="text-xs text-gray-500">${m.address}</span>` : ""}`,
        );
        new MLMarker({ color: "#b45309" })
          .setLngLat([m.longitude, m.latitude])
          .setPopup(popup)
          .addTo(map!);
      }

      // Fit bounds when multiple markers
      if (validMarkers.length > 1) {
        const lngs = validMarkers.map((m) => m.longitude);
        const lats = validMarkers.map((m) => m.latitude);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 60, maxZoom: 15 },
        );
      }
    });

    return () => {
      map?.remove();
    };
  }, [markers, center]);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-64 w-full rounded-lg border border-[var(--color-border)]"}
    />
  );
}
