import { Card } from "@/components/ui/card";

export function StorageImage({
  src,
  alt,
  className = "h-48 w-full rounded-3xl object-cover",
  fallbackLabel = "Image coming soon",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}) {
  if (!src) {
    return (
      <Card className="flex h-48 items-center justify-center bg-slate-50 text-sm text-[var(--color-muted)]">
        {fallbackLabel}
      </Card>
    );
  }

  // Signed/private storage URLs are generated server-side and may not be compatible with Next image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
