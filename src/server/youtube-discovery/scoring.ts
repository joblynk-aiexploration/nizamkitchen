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
  "vahchef", "cook with", "home cooking", "cooking channel", "cooking show",
  "hebbar", "vahrehvah", "spice", "curry", "indian food", "desi",
];

const PROFESSIONAL_TITLE_KEYWORDS = [
  "restaurant style", "authentic", "restaurant", "michelin", "culinary",
  "professional", "hotel style", "dhaba style",
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

// Dish types that are inherently complex/long (biryani, haleem, korma)
const COMPLEX_DISH_TERMS = [
  "biryani", "haleem", "korma", "nihari", "paya", "kofta", "kebab", "dum",
];

// Dish types that are simple/quick (chutneys, raitas, salads)
const SIMPLE_DISH_TERMS = [
  "chutney", "raita", "salad", "pickle", "achaar", "dip", "sauce",
];

function getDishDurationRange(recipeName: string): { min: number; ideal: number; max: number } {
  const lower = recipeName.toLowerCase();
  if (COMPLEX_DISH_TERMS.some((t) => lower.includes(t))) {
    return { min: 480, ideal: 900, max: 2700 }; // 8–45 min
  }
  if (SIMPLE_DISH_TERMS.some((t) => lower.includes(t))) {
    return { min: 180, ideal: 480, max: 1200 }; // 3–20 min
  }
  return { min: 300, ideal: 720, max: 2700 }; // 5–45 min default
}

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

  if (normVideo.includes(normRecipe)) return 40;

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
    professionalSignals.push("Professional-looking cooking signal in title.");
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

  // ── Duration (dish-type-aware) ────────────────────────────────────────────
  if (video.durationSeconds !== null) {
    const range = getDishDurationRange(recipeName);
    if (video.durationSeconds < 60) {
      score -= 30;
      rejectionReasons.push("Video is extremely short (< 1 min).");
    } else if (video.durationSeconds < range.min) {
      score -= 20;
      rejectionReasons.push(`Video is short for this dish type (${Math.floor(video.durationSeconds / 60)} min).`);
    } else if (video.durationSeconds <= range.max) {
      score += 10;
      scoreReasons.push(`Good duration for this dish (${Math.floor(video.durationSeconds / 60)} min).`);
      if (video.durationSeconds >= range.ideal) {
        score += 5;
        scoreReasons.push("Full recipe walkthrough length.");
      }
    }
    // Excessively long videos (> max) get no bonus but no penalty either
  }

  // ── HD signal ────────────────────────────────────────────────────────────
  // (isShort check above handles YouTube Shorts; no separate HD flag in YouTubeVideoDetails)

  // ── Views ─────────────────────────────────────────────────────────────────
  if (video.viewCount !== null) {
    if (video.viewCount >= BigInt(1_000_000)) {
      score += 20;
      scoreReasons.push(`High view count (${(Number(video.viewCount) / 1_000_000).toFixed(1)}M views).`);
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
    professionalSignals.push("Needs review — no strong cooking-channel signals detected.");
  }

  return {
    score: Math.max(score, -100),
    professionalSignals,
    scoreReasons,
    rejectionReasons,
  };
}
