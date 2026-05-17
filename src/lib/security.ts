import { NextResponse } from "next/server";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export const defaultSecurityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "off",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
} as const;

export function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(defaultSecurityHeaders)) {
    response.headers.set(key, value);
  }

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
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
