import { beforeAll, describe, expect, it, vi } from "vitest";
import { applySecurityHeaders, enforceRateLimit, rateLimitPolicies } from "../../src/lib/security";

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://test";
});

describe("production env validation", () => {
  it("fails fast in production without SESSION_SECRET", async () => {
    const { validateEnv } = await import("../../src/lib/env");
    const result = validateEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://example",
      APP_URL: "https://nizamkitchen.example.com",
    } as NodeJS.ProcessEnv);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.SESSION_SECRET?.[0]).toContain("SESSION_SECRET is required");
    }
  });

  it("allows missing optional Google Maps and YouTube keys", async () => {
    const { validateEnv } = await import("../../src/lib/env");
    const result = validateEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://example",
      APP_URL: "https://nizamkitchen.example.com",
      SESSION_SECRET: "a-production-secret-with-more-than-32-characters",
    } as NodeJS.ProcessEnv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.GOOGLE_MAPS_BROWSER_API_KEY).toBe("");
      expect(result.data.YOUTUBE_DATA_API_KEY).toBe("");
    }
  });
});

describe("security headers and rate limits", () => {
  it("sets defensive security headers while allowing YouTube frames", () => {
    const response = applySecurityHeaders(new Response(null) as never);
    const csp = response.headers.get("Content-Security-Policy") ?? "";

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src https://www.youtube.com https://www.youtube-nocookie.com");
    expect(csp).toContain("https://*.googleusercontent.com");
    expect(csp).toContain("https://platform-lookaside.fbsbx.com");
    expect(csp).toContain("https://*.amazonaws.com");
    expect(csp).toContain("https://www.googletagmanager.com");
    expect(csp).toContain("https://www.google-analytics.com");
    expect(csp).toContain("https://*.google-analytics.com");
    expect(csp).toContain("https://app.secureprivacy.ai");
    expect(csp).toContain("https://*.secureprivacy.ai");
    expect(csp).toContain("https://static.cloudflareinsights.com");
  });

  it("sets a production HSTS max age without preload-only assumptions", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = applySecurityHeaders(new Response(null) as never);

    expect(response.headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
    vi.unstubAllEnvs();
  });

  it("enforces login rate limit policy", () => {
    const key = `test-login-${crypto.randomUUID()}`;

    for (let index = 0; index < rateLimitPolicies.login.limit; index += 1) {
      expect(() => enforceRateLimit({ key, ...rateLimitPolicies.login })).not.toThrow();
    }

    expect(() => enforceRateLimit({ key, ...rateLimitPolicies.login })).toThrow("RATE_LIMIT_EXCEEDED");
  });
});
