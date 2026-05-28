"use client";

import { MapPin, ExternalLink, Star } from "lucide-react";
import { Card } from "@/components/ui/card";

type Props = {
  name: string;
  address?: string | null;
  category?: string | null;
  mapUrl?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  priceLevel?: number | null;
  openNow?: boolean | null;
  footer?: React.ReactNode;
};

function formatPriceLevel(priceLevel: number | null | undefined) {
  if (!priceLevel || priceLevel < 1) return null;
  return "$".repeat(Math.min(priceLevel, 4));
}

export function PlaceResultCard({
  name,
  address,
  category,
  mapUrl,
  rating,
  ratingCount,
  priceLevel,
  openNow,
  footer,
}: Props) {
  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-1">
        <p className="font-semibold text-[var(--color-ink)]">{name}</p>
        {category ? <p className="text-xs text-[var(--color-muted)]">{category}</p> : null}
      </div>

      {address ? (
        <div className="flex items-start gap-1.5 text-sm text-[var(--color-muted)]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{address}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
        {typeof rating === "number" ? (
          <span className="inline-flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-500" />
            {rating.toFixed(1)}
            {typeof ratingCount === "number" ? ` (${ratingCount})` : ""}
          </span>
        ) : null}
        {formatPriceLevel(priceLevel) ? <span>{formatPriceLevel(priceLevel)}</span> : null}
        {typeof openNow === "boolean" ? (
          <span className={openNow ? "text-green-700" : "text-slate-500"}>
            {openNow ? "Open now" : "Hours unavailable or closed"}
          </span>
        ) : null}
      </div>

      {mapUrl ? (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          View on Google Maps <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}

      {footer}
    </Card>
  );
}
