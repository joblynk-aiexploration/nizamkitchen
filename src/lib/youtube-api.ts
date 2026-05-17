// Server-side only — never import in client components.
// The YOUTUBE_DATA_API_KEY is never exposed to the browser.

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
};

export type YouTubeVideoDetails = {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  durationSeconds: number | null;
  viewCount: bigint | null;
  likeCount: bigint | null;
  commentCount: bigint | null;
  embeddable: boolean;
  isShort: boolean;
};

export type YouTubeChannelDetails = {
  channelId: string;
  title: string;
  description: string;
  subscriberCount: bigint | null;
  videoCount: bigint | null;
  country: string | null;
};

function parseDuration(iso8601: string): number | null {
  if (!iso8601) return null;
  const match = iso8601.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const h = parseInt(match[1] ?? "0", 10);
  const m = parseInt(match[2] ?? "0", 10);
  const s = parseInt(match[3] ?? "0", 10);
  return h * 3600 + m * 60 + s;
}

function parseBigInt(val: string | undefined): bigint | null {
  if (!val) return null;
  try {
    return BigInt(val);
  } catch {
    return null;
  }
}

export async function searchYouTubeVideos(params: {
  query: string;
  apiKey: string;
  maxResults?: number;
  regionCode?: string;
  relevanceLanguage?: string;
  videoDuration?: "any" | "long" | "medium" | "short";
}): Promise<YouTubeSearchResult[]> {
  const { query, apiKey, maxResults = 8, regionCode, relevanceLanguage, videoDuration = "any" } = params;

  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("order", "relevance");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("q", query);
  if (regionCode) url.searchParams.set("regionCode", regionCode);
  if (relevanceLanguage) url.searchParams.set("relevanceLanguage", relevanceLanguage);
  if (videoDuration !== "any") url.searchParams.set("videoDuration", videoDuration);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube search API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const items: YouTubeSearchResult[] = [];

  for (const item of data.items ?? []) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;
    const snippet = item.snippet ?? {};
    items.push({
      videoId,
      title: snippet.title ?? "",
      description: snippet.description ?? "",
      channelId: snippet.channelId ?? "",
      channelTitle: snippet.channelTitle ?? "",
      thumbnailUrl:
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.medium?.url ??
        snippet.thumbnails?.default?.url ??
        "",
      publishedAt: snippet.publishedAt ?? "",
    });
  }

  return items;
}

export async function getYouTubeVideoDetails(params: {
  videoIds: string[];
  apiKey: string;
}): Promise<YouTubeVideoDetails[]> {
  const { videoIds, apiKey } = params;
  if (videoIds.length === 0) return [];

  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("part", "snippet,contentDetails,statistics,status");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube videos API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const details: YouTubeVideoDetails[] = [];

  for (const item of data.items ?? []) {
    const videoId = item.id;
    if (!videoId) continue;
    const snippet = item.snippet ?? {};
    const contentDetails = item.contentDetails ?? {};
    const statistics = item.statistics ?? {};
    const status = item.status ?? {};

    const durationSeconds = parseDuration(contentDetails.duration ?? "");
    const embeddable = status.embeddable !== false;

    // YouTube Shorts are typically <= 60 seconds
    const isShort = durationSeconds !== null && durationSeconds <= 62;

    details.push({
      videoId,
      title: snippet.title ?? "",
      description: snippet.description ?? "",
      channelId: snippet.channelId ?? "",
      channelTitle: snippet.channelTitle ?? "",
      thumbnailUrl:
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.medium?.url ??
        snippet.thumbnails?.default?.url ??
        "",
      publishedAt: snippet.publishedAt ?? "",
      durationSeconds,
      viewCount: parseBigInt(statistics.viewCount),
      likeCount: parseBigInt(statistics.likeCount),
      commentCount: parseBigInt(statistics.commentCount),
      embeddable,
      isShort,
    });
  }

  return details;
}

export async function getYouTubeChannelDetails(params: {
  channelIds: string[];
  apiKey: string;
}): Promise<YouTubeChannelDetails[]> {
  const { channelIds, apiKey } = params;
  if (channelIds.length === 0) return [];

  const url = new URL(`${YOUTUBE_API_BASE}/channels`);
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", channelIds.join(","));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });

  if (!res.ok) return [];

  const data = await res.json();
  const channels: YouTubeChannelDetails[] = [];

  for (const item of data.items ?? []) {
    const channelId = item.id;
    if (!channelId) continue;
    const snippet = item.snippet ?? {};
    const statistics = item.statistics ?? {};
    channels.push({
      channelId,
      title: snippet.title ?? "",
      description: snippet.description ?? "",
      subscriberCount: parseBigInt(statistics.subscriberCount),
      videoCount: parseBigInt(statistics.videoCount),
      country: snippet.country ?? null,
    });
  }

  return channels;
}
