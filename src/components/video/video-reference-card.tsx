import type { RecipeMediaReference } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatYouTubeDuration } from "@/lib/youtube";

type Props = {
  ref_: RecipeMediaReference;
  showEmbed?: boolean;
};

export function VideoReferenceCard({ ref_: ref, showEmbed = true }: Props) {
  const isYouTube = ref.type === "youtube" && ref.embedUrl;

  return (
    <Card className="overflow-hidden p-0">
      {isYouTube && showEmbed && (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={ref.embedUrl!}
            title={ref.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[var(--color-ink)] truncate">{ref.title}</p>
            {ref.creatorName && (
              <p className="text-sm text-[var(--color-muted)]">{ref.creatorName}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {ref.language && <Badge tone="neutral">{ref.language}</Badge>}
            {ref.durationSeconds && (
              <Badge tone="neutral">{formatYouTubeDuration(ref.durationSeconds)}</Badge>
            )}
          </div>
        </div>
        {ref.notes && (
          <p className="text-xs text-[var(--color-muted)] italic">{ref.notes}</p>
        )}
        <a
          href={ref.normalizedUrl ?? ref.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open on YouTube
        </a>
      </div>
    </Card>
  );
}
