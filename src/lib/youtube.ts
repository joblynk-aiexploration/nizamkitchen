export type YouTubeParseResult = {
  externalId: string;
  normalizedUrl: string;
  embedUrl: string;
};

const ALLOWED_YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isValidYouTubeId(id: string): boolean {
  return YOUTUBE_ID_RE.test(id);
}

export function parseYouTubeUrl(raw: string): YouTubeParseResult | null {
  if (!raw || typeof raw !== "string") return null;

  // Reject obvious non-URL strings (iframe HTML, javascript:, etc.)
  const trimmed = raw.trim();
  if (trimmed.startsWith("<") || trimmed.toLowerCase().startsWith("javascript:")) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  // Only allow https/http
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  // Only allow known YouTube domains
  if (!ALLOWED_YOUTUBE_HOSTS.has(url.hostname)) return null;

  let videoId: string | null = null;

  if (url.hostname === "youtu.be" || url.hostname === "www.youtu.be") {
    // https://youtu.be/VIDEO_ID
    videoId = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (url.pathname.startsWith("/shorts/")) {
    // https://www.youtube.com/shorts/VIDEO_ID
    videoId = url.pathname.split("/")[2] ?? null;
  } else if (url.pathname.startsWith("/embed/")) {
    // https://www.youtube.com/embed/VIDEO_ID
    videoId = url.pathname.split("/")[2] ?? null;
  } else if (url.pathname === "/watch" || url.pathname.startsWith("/watch")) {
    // https://www.youtube.com/watch?v=VIDEO_ID
    videoId = url.searchParams.get("v");
  }

  if (!videoId || !isValidYouTubeId(videoId)) return null;

  return {
    externalId: videoId,
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  };
}

export function isYouTubeUrl(raw: string): boolean {
  return parseYouTubeUrl(raw) !== null;
}

export function formatYouTubeDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
