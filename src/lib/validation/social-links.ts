import { z } from "zod";

const profileTypes = ["home_catering", "chef_business", "restaurant"] as const;
const platforms = ["instagram", "facebook", "tiktok", "youtube", "whatsapp", "website", "x", "snapchat", "other"] as const;

const allowedHosts: Record<(typeof platforms)[number], string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  youtube: ["youtube.com", "www.youtube.com"],
  whatsapp: ["wa.me", "api.whatsapp.com"],
  website: [],
  x: ["x.com", "twitter.com"],
  snapchat: ["snapchat.com", "www.snapchat.com"],
  other: [],
};

const blockedHtmlPattern = /<\s*(iframe|script|embed|object|a)\b|<\/|>/i;

export function normalizeSocialUrl(platform: (typeof platforms)[number], rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed || blockedHtmlPattern.test(trimmed)) {
    throw new Error("Enter a clean URL, not embed code or HTML.");
  }
  if (/^(javascript|data|file):/i.test(trimmed)) {
    throw new Error("This URL type is not allowed.");
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Social links must use https.");
  }
  parsed.hash = "";
  const host = parsed.hostname.toLowerCase();
  const platformHosts = allowedHosts[platform];
  if (platformHosts.length > 0 && !platformHosts.includes(host)) {
    throw new Error(`${platform} links must use an approved ${platform} domain.`);
  }
  return parsed.toString();
}

export const businessSocialLinkSchema = z.object({
  linkId: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(80).nullable(),
  ).optional(),
  profileType: z.enum(profileTypes),
  platform: z.enum(platforms),
  label: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? null : value),
    z.string().trim().max(80).nullable(),
  ).optional(),
  url: z.string().trim().min(3).max(500),
  displayOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isPublic: z.coerce.boolean().default(false),
}).transform((value) => ({
  ...value,
  url: normalizeSocialUrl(value.platform, value.url),
}));

export const businessSocialLinkDeleteSchema = z.object({
  linkId: z.string().trim().min(1),
});

export type BusinessSocialLinkInput = z.input<typeof businessSocialLinkSchema>;
