import { NextResponse } from "next/server";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export const defaultSecurityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://app.secureprivacy.ai https://cmp.secureprivacy.ai https://*.secureprivacy.ai https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://app.secureprivacy.ai https://cmp.secureprivacy.ai https://*.secureprivacy.ai",
    "img-src 'self' data: blob: https://img.youtube.com https://i.ytimg.com https://maps.googleapis.com https://maps.gstatic.com https://*.gstatic.com https://*.googleusercontent.com https://www.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://stats.g.doubleclick.net https://app.secureprivacy.ai https://cmp.secureprivacy.ai https://*.secureprivacy.ai https://platform-lookaside.fbsbx.com https://*.fbcdn.net https://*.s3.amazonaws.com https://*.amazonaws.com",
    "font-src 'self' data: https://app.secureprivacy.ai https://cmp.secureprivacy.ai https://*.secureprivacy.ai",
    "connect-src 'self' https://maps.googleapis.com https://places.googleapis.com https://geocode.googleapis.com https://maps.gstatic.com https://*.gstatic.com https://www.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://region1.google-analytics.com https://stats.g.doubleclick.net https://app.secureprivacy.ai https://cmp.secureprivacy.ai https://*.secureprivacy.ai",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://app.secureprivacy.ai https://cmp.secureprivacy.ai https://*.secureprivacy.ai",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
} as const;

export function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(defaultSecurityHeaders)) {
    response.headers.set(key, value);
  }

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000",
    );
  }

  return response;
}

export function createRequestId() {
  return crypto.randomUUID();
}

export function getClientIpFromHeaders(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export function enforceRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const current = rateLimitStore.get(options.key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(options.key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return;
  }

  if (current.count >= options.limit) {
    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  current.count += 1;
  rateLimitStore.set(options.key, current);
}

export function rateLimitKey(scope: string, request: Request, identifier = "") {
  const ip = getClientIpFromHeaders(request.headers);
  return `${scope}:${ip}:${identifier}`;
}

export const rateLimitPolicies = {
  login: { limit: 10, windowMs: 60_000 },
  passwordReset: { limit: 5, windowMs: 60_000 },
  publicShare: { limit: 120, windowMs: 60_000 },
  restaurantSearch: { limit: 20, windowMs: 60_000 },
  youtubeDiscovery: { limit: 6, windowMs: 60_000 },
  adminBulkAction: { limit: 10, windowMs: 60_000 },
} as const;
