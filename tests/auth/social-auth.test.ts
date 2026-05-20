import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationType } from "@prisma/client";

const cookieState = new Map<string, string>();

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    oAuthAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      update: vi.fn(),
    },
    country: {
      findUnique: vi.fn(),
    },
    organization: {
      create: vi.fn(),
    },
    membership: {
      create: vi.fn(),
    },
    householdProfile: {
      create: vi.fn(),
    },
    homeCateringProfile: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieState.get(name);
      return value ? { value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieState.set(name, value);
    },
  }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    APP_URL: "https://app.nizamkitchen.test",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth/password", () => ({ hashPassword: vi.fn(async () => "hashed-social-password") }));
vi.mock("@/lib/session", () => ({
  createSession: vi.fn(async () => ({ token: "session-token", expiresAt: new Date() })),
  getRequestMetadata: vi.fn(async () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" })),
}));
vi.mock("@/server/audit", () => ({ createAuditEvent: vi.fn() }));
vi.mock("@/server/legal/legal-service", () => ({
  createAcceptance: vi.fn(),
  getRequiredLegalDocumentsForUser: vi.fn(async () => []),
}));
vi.mock("@/server/config/platform-config-service", () => ({
  getActiveIntegration: vi.fn(),
}));

import { createSession } from "@/lib/session";
import { createAuditEvent } from "@/server/audit";
import { getActiveIntegration } from "@/server/config/platform-config-service";
import {
  beginOAuthFlow,
  createOAuthStatePayload,
  finishOAuthCallback,
  listVisibleSocialAuthProviders,
  verifyOAuthStatePayload,
} from "@/server/auth/oauth-service";

describe("social auth service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cookieState.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows Google when enabled and hides register buttons when auto-create is disabled", async () => {
    vi.mocked(getActiveIntegration)
      .mockResolvedValueOnce({
        id: "google-auth",
        credentials: [
          { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
          { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
        ],
        settings: [
          { settingKey: "loginButtonVisible", settingValueJson: true, isSecret: false },
          { settingKey: "autoCreateUser", settingValueJson: false, isSecret: false },
        ],
      } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "google-auth",
        credentials: [
          { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
          { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
        ],
        settings: [
          { settingKey: "loginButtonVisible", settingValueJson: true, isSecret: false },
          { settingKey: "autoCreateUser", settingValueJson: false, isSecret: false },
        ],
      } as never)
      .mockResolvedValueOnce(null);

    const loginProviders = await listVisibleSocialAuthProviders("login");
    const registerProviders = await listVisibleSocialAuthProviders("register");

    expect(loginProviders.map((provider) => provider.provider)).toEqual(["google"]);
    expect(registerProviders).toHaveLength(0);
  });

  it("generates and verifies OAuth state while blocking open redirects", () => {
    const payload = createOAuthStatePayload("login", "//evil.example.com");
    expect(payload.redirectTo).toBeNull();
    expect(verifyOAuthStatePayload(payload, payload.state)).toBe(true);
    expect(verifyOAuthStatePayload(payload, "wrong-state")).toBe(false);
  });

  it("links an existing user by verified Google email", async () => {
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
        { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
      ],
      settings: [],
    } as never);

    await beginOAuthFlow({ provider: "google", flow: "login", redirectTo: "https://evil.example.com" });

    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ access_token: "google-access-token" }))
      .mockResolvedValueOnce(
        Response.json({
          sub: "google-user-123",
          email: "owner@example.test",
          email_verified: true,
          name: "Nizam Owner",
          picture: "https://example.com/avatar.png",
        }),
      );

    mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "owner@example.test",
      fullName: "Existing User",
      platformRole: null,
      status: "active",
      memberships: [{ organizationId: "org-1" }],
    });
    mockPrisma.oAuthAccount.create.mockResolvedValue({ id: "oauth-1" });
    mockPrisma.user.update.mockResolvedValue({ id: "user-1" });

    const redirectPath = await finishOAuthCallback({
      provider: "google",
      requestUrl: "https://app.nizamkitchen.test/api/auth/oauth/google/callback?code=test-code&state=" +
        JSON.parse(cookieState.get("nk_oauth_state_google") ?? "{}").state,
    });

    expect(mockPrisma.oAuthAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          provider: "google",
          providerAccountId: "google-user-123",
        }),
      }),
    );
    expect(createSession).toHaveBeenCalledWith("user-1", "org-1");
    expect(redirectPath).toBe("/dashboard");
  });

  it("sends a brand-new social user to onboarding", async () => {
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "facebook-auth",
      credentials: [
        { keyName: "app_id", value: "facebook-app-id", isPublicClientValue: true },
        { keyName: "app_secret", value: "facebook-secret", isPublicClientValue: false },
      ],
      settings: [
        { settingKey: "autoCreateUser", settingValueJson: true, isSecret: false },
        { settingKey: "defaultOrganizationType", settingValueJson: OrganizationType.home_catering, isSecret: false },
      ],
    } as never);

    await beginOAuthFlow({ provider: "facebook", flow: "register" });

    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ access_token: "facebook-access-token" }))
      .mockResolvedValueOnce(
        Response.json({
          id: "facebook-user-456",
          email: "seller@example.test",
          name: "Amina Seller",
          verified: true,
          picture: { data: { url: "https://example.com/avatar.png" } },
        }),
      );

    mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-2",
      email: "seller@example.test",
      fullName: "Amina Seller",
      platformRole: null,
      status: "active",
    });
    mockPrisma.user.update.mockResolvedValue({ id: "user-2" });

    const redirectPath = await finishOAuthCallback({
      provider: "facebook",
      requestUrl: "https://app.nizamkitchen.test/api/auth/oauth/facebook/callback?code=test-code&state=" +
        JSON.parse(cookieState.get("nk_oauth_state_facebook") ?? "{}").state,
    });

    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(redirectPath).toBe("/onboarding/social?type=catering");
  });

  it("rejects invalid callback state", async () => {
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
        { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
      ],
      settings: [],
    } as never);

    await beginOAuthFlow({ provider: "google", flow: "login" });

    await expect(
      finishOAuthCallback({
        provider: "google",
        requestUrl: "https://app.nizamkitchen.test/api/auth/oauth/google/callback?code=test-code&state=bad-state",
      }),
    ).rejects.toThrow("OAuth state verification failed.");
  });

  it("keeps admin OAuth pages server-side protected and avoids open redirect code", async () => {
    const googlePage = await fs.readFile("src/app/(app)/admin/configuration/auth/google/page.tsx", "utf8");
    const facebookPage = await fs.readFile("src/app/(app)/admin/configuration/auth/facebook/page.tsx", "utf8");
    const callbackRoute = await fs.readFile("src/app/api/auth/oauth/google/callback/route.ts", "utf8");

    expect(googlePage).toContain("requirePlatformRole");
    expect(facebookPage).toContain("requirePlatformRole");
    expect(callbackRoute).toContain("finishOAuthCallback");
    expect(callbackRoute).not.toContain("redirectTo=");
  });

  it("records OAuth login and failure audits", async () => {
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
        { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
      ],
      settings: [],
    } as never);

    await beginOAuthFlow({ provider: "google", flow: "login" });

    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ access_token: "google-access-token" }))
      .mockResolvedValueOnce(
        Response.json({
          sub: "google-user-999",
          email: "household@example.test",
          email_verified: true,
          name: "Household User",
        }),
      );

    mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-3",
      email: "household@example.test",
      fullName: "Household User",
      platformRole: null,
      status: "active",
      memberships: [],
    });
    mockPrisma.oAuthAccount.create.mockResolvedValue({ id: "oauth-3" });
    mockPrisma.user.update.mockResolvedValue({ id: "user-3" });

    await finishOAuthCallback({
      provider: "google",
      requestUrl: "https://app.nizamkitchen.test/api/auth/oauth/google/callback?code=test-code&state=" +
        JSON.parse(cookieState.get("nk_oauth_state_google") ?? "{}").state,
    });

    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "user.oauth_login" }));
  });
});
