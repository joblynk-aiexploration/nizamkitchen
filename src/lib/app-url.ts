import { env } from "@/lib/env";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export type OAuthCallbackProvider = "google" | "facebook";

export function isLocalhostUrl(value: string) {
  try {
    return LOCAL_HOSTNAMES.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function isProductionRuntime() {
  return env.NODE_ENV === "production";
}

export function getAppBaseUrl(requestOrigin?: string | null) {
  const baseUrl = isProductionRuntime()
    ? env.APP_URL
    : requestOrigin || env.APP_URL || "http://localhost:3000";

  assertNoLocalhostInProduction(baseUrl);
  return new URL(baseUrl).origin;
}

export function getOAuthCallbackPath(provider: OAuthCallbackProvider) {
  return provider === "google"
    ? "/api/auth/oauth/google/callback"
    : "/api/auth/oauth/facebook/callback";
}

export function getOAuthCallbackUrl(provider: OAuthCallbackProvider, requestOrigin?: string | null) {
  return new URL(getOAuthCallbackPath(provider), getAppBaseUrl(requestOrigin)).toString();
}

export function assertNoLocalhostInProduction(value: string) {
  if (env.NODE_ENV === "production" && isLocalhostUrl(value)) {
    throw new Error(
      "Production Google OAuth callback is misconfigured. Configure APP_URL=https://nk.friscodawah.org and update Google OAuth callback URL.",
    );
  }
}

export function getSafeRedirectUrl<TFallback extends string | null = string>(
  pathOrUrl: string | null | undefined,
  fallback: TFallback = "/dashboard" as TFallback,
): string | TFallback {
  if (!pathOrUrl) return fallback;
  if (pathOrUrl.startsWith("/") && !pathOrUrl.startsWith("//") && !pathOrUrl.includes("\n") && !pathOrUrl.includes("\r")) {
    return pathOrUrl;
  }

  try {
    const candidate = new URL(pathOrUrl);
    const appOrigin = getAppBaseUrl();
    if (candidate.origin === appOrigin && !isLocalhostUrl(candidate.toString())) {
      return `${candidate.pathname}${candidate.search}${candidate.hash}`;
    }
  } catch {
    // Fall through to fallback.
  }

  return fallback;
}
