import type { YouTubeVideoDetails, YouTubeChannelDetails } from "@/lib/youtube-api";

export type ScoreResult = {
  score: number;
  professionalSignals: string[];
  scoreReasons: string[];
  rejectionReasons: string[];
};

const COOKING_CHANNEL_KEYWORDS = [
  "kitchen", "cook", "chef", "recipe", "food", "cuisine", "culinary",
  "biryani", "masala", "tadka", "dum", "authentic", "bake", "grill",
];

const PROFESSIONAL_TITLE_KEYWORDS = [
  "chef", "restaurant style", "professional", "authentic", "restaurant",
  "michelin", "culinary",
];

const POSITIVE_TITLE_KEYWORDS = [
  "recipe", "cooking", "how to make", "how to cook", "step by step",
  "homemade", "traditional", "authentic", "restaurant style", "dum",
  "hyderabadi", "nizami", "special", "easy", "quick",
];

const NEGATIVE_KEYWORDS = [
  "mukbang", "asmr eating", "eating challenge", "food challenge", "food review",
  "taste test", "restaurant review", "street food tour", "travel vlog",
  "reaction", "prank", "challenge", "shorts", "#shorts",
];

const SPAM_PATTERNS = [
  /^\d+\s*(likes?|views?|subscribers?)/i,
  /free\s*money/i,
  /click\s*here/i,
  /\b(hot|sexy|viral)\b/i,
];

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function titleContains(title: string, keywords: string[]): string[] {
  const norm = normalizeTitle(title);
  return keywords.filter((kw) => norm.includes(kw.toLowerCase()));
}

function recipeTitleMatch(videoTitle: string, recipeName: string): number {
  const normVideo = normalizeTitle(videoTitle);
  const normRecipe = normalizeTitle(recipeName);

  // Full recipe name in title
  if (normVideo.includes(normRecipe)) return 40;

  // All words of recipe name found in video title
  const recipeWords = normRecipe.split(/\s+/).filter((w) => w.length > 2);
  const matchedWords = recipeWords.filter((w) => normVideo.includes(w));
  if (recipeWords.length > 0 && matchedWords.length === recipeWords.length) return 30;
  if (recipeWords.length > 0 && matchedWords.length >= Math.ceil(recipeWords.length * 0.7)) return 20;
  if (recipeWords.length > 0 && matchedWords.length >= Math.ceil(recipeWords.length * 0.5)) return 10;

  return 0;
}

function channelIsCookingFocused(channelTitle: string, description: string): boolean {
  const combined = (channelTitle + " " + description).toLowerCase();
  return COOKING_CHANNEL_KEYWORDS.some((kw) => combined.includes(kw));
}

export function scoreCandidate(params: {
  video: YouTubeVideoDetails;
  channel: YouTubeChannelDetails | null;
  recipeName: string;
  searchQuery: string;
}): ScoreResult {
  const { video, channel, recipeName } = params;
  const professionalSignals: string[] = [];
  const scoreReasons: string[] = [];
  const rejectionReasons: string[] = [];
  let score = 0;

  // ── Reject non-embeddable ──────────────────────────────────────────────────
  if (!video.embeddable) {
    rejectionReasons.push("Video is not embeddable.");
    return { score: -100, professionalSignals, scoreReasons, rejectionReasons };
  }

  // ── Check for Shorts ──────────────────────────────────────────────────────
  const titleLower = video.title.toLowerCase();
  const isExplicitShort = titleLower.includes("#shorts") || titleLower.includes("shorts");
  if (video.isShort || isExplicitShort) {
    rejectionReasons.push("Video appears to be a Short (too brief for a full recipe).");
    score -= 30;
  }

  // ── Spam / negative keyword check ─────────────────────────────────────────
  const negativeHits = titleContains(video.title, NEGATIVE_KEYWORDS);
  if (negativeHits.length > 0) {
    rejectionReasons.push(`Title contains off-topic signals: ${negativeHits.slice(0, 2).join(", ")}.`);
    // Strong penalty — off-topic content should not rank positively even with high view counts
    score -= 60;
  }

  const spamHit = SPAM_PATTERNS.some((p) => p.test(video.title));
  if (spamHit) {
    rejectionReasons.push("Title matches spam pattern.");
    score -= 50;
  }

  // ── Recipe title match ────────────────────────────────────────────────────
  const matchScore = recipeTitleMatch(video.title, recipeName);
  if (matchScore >= 30) {
    scoreReasons.push("High-confidence recipe name match in title.");
    score += matchScore;
  } else if (matchScore >= 10) {
    scoreReasons.push("Partial recipe name match in title.");
    score += matchScore;
  } else {
    rejectionReasons.push("Video title does not closely match recipe name.");
    score -= 20;
  }

  // ── Positive title keywords ───────────────────────────────────────────────
  const positiveHits = titleContains(video.title, POSITIVE_TITLE_KEYWORDS);
  if (positiveHits.length > 0) {
    score += Math.min(positiveHits.length * 5, 15);
    scoreReasons.push(`Recipe-related terms: ${positiveHits.slice(0, 3).join(", ")}.`);
  }

  // ── Professional title signals ────────────────────────────────────────────
  const profTitleHits = titleContains(video.title, PROFESSIONAL_TITLE_KEYWORDS);
  if (profTitleHits.length > 0) {
    score += 10;
    professionalSignals.push("Professional-looking title signal.");
  }

  // ── Channel analysis ──────────────────────────────────────────────────────
  const channelTitle = channel?.title ?? video.channelTitle;
  if (channelIsCookingFocused(channelTitle, channel?.description ?? "")) {
    score += 15;
    professionalSignals.push("Cooking-channel signal.");
    scoreReasons.push("Channel title/description indicates cooking focus.");
  }

  if (channel?.subscriberCount != null && channel.subscriberCount > BigInt(100_000)) {
    score += 10;
    scoreReasons.push(`Channel has ${(Number(channel.subscriberCount) / 1000).toFixed(0)}K+ subscribers.`);
    if (channel.subscriberCount > BigInt(1_000_000)) {
      professionalSignals.push("Large cooking channel (1M+ subscribers).");
    }
  }

  // ── Duration ─────────────────────────────────────────────────────────────
  if (video.durationSeconds !== null) {
    if (video.durationSeconds < 120) {
      score -= 20;
      rejectionReasons.push("Video is very short for a recipe (< 2 min).");
    } else if (video.durationSeconds >= 300) {
      score += 10;
      scoreReasons.push(`Good duration (${Math.floor(video.durationSeconds / 60)} min).`);
    }
    if (video.durationSeconds >= 600) {
      score += 5;
      scoreReasons.push("Full recipe walkthrough length.");
    }
  }

  // ── Views ─────────────────────────────────────────────────────────────────
  if (video.viewCount !== null) {
    if (video.viewCount >= BigInt(1_000_000)) {
      score += 20;
      scoreReasons.push(`High view count (${(Number(video.viewCount) / 1_000_000).toFixed(1)}M views).`);
      professionalSignals.push("High-confidence recipe match.");
    } else if (video.viewCount >= BigInt(100_000)) {
      score += 10;
      scoreReasons.push(`Good view count (${(Number(video.viewCount) / 1000).toFixed(0)}K views).`);
    } else if (video.viewCount >= BigInt(10_000)) {
      score += 5;
    } else if (video.viewCount < BigInt(1_000)) {
      score -= 5;
    }
  }

  // ── Professional-looking summary ─────────────────────────────────────────
  if (professionalSignals.length === 0) {
    professionalSignals.push("Needs review — no strong professional signals detected.");
  }

  return {
    score: Math.max(score, -100),
    professionalSignals,
    scoreReasons,
    rejectionReasons,
  };
}
