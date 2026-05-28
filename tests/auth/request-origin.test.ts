import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    APP_URL: "https://nk.friscodawah.org",
    NODE_ENV: "production",
    DEPLOYMENT_ENVIRONMENT: "production",
  },
}));

import {
  getPublicOriginFromHeaders,
  getPublicRequestOrigin,
  publicRedirectUrl,
} from "@/lib/request-origin";

describe("public request origin", () => {
  it("uses APP_URL when production proxy exposes an internal localhost host", () => {
    const request = new Request("http://localhost:3000/api/auth/oauth/google/callback", {
      headers: {
        host: "localhost:3000",
      },
    });

    expect(getPublicRequestOrigin(request)).toBe("https://nk.friscodawah.org");
    expect(publicRedirectUrl("/login", request).toString()).toBe("https://nk.friscodawah.org/login");
  });

  it("uses forwarded production host when Nginx sends public host headers", () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "nk.friscodawah.org",
      "x-forwarded-proto": "https",
    });

    expect(getPublicOriginFromHeaders(headers, "http://localhost:3000")).toBe("https://nk.friscodawah.org");
  });
});
