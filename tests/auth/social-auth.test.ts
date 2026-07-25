import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationType } from "@prisma/client";

const cookieState = new Map<string, string>();

const { mockPrisma, mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    APP_URL: "https://app.nizamkitchen.test",
    NODE_ENV: "test",
    DEPLOYMENT_ENVIRONMENT: "local",
    GOOGLE_OAUTH_CLIENT_ID: "env-google-client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "env-google-client-secret",
    GOOGLE_OAUTH_CALLBACK_URL: "",
    FACEBOOK_OAUTH_APP_ID: "",
    FACEBOOK_OAUTH_APP_SECRET: "",
    FACEBOOK_OAUTH_CALLBACK_URL: "",
  },
  mockPrisma: {
    oAuthAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    platformIntegration: {
      findFirst: vi.fn(),
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
  env: mockEnv,
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
vi.mock("@/server/billing/plans", () => ({
  getActiveBillingPlanBySlug: vi.fn(),
}));
vi.mock("@/server/payments/providers/stripe/stripe-adapter", () => ({
  createStripeSubscriptionCheckout: vi.fn(),
}));

import { createSession } from "@/lib/session";
import { createAuditEvent } from "@/server/audit";
import { getActiveBillingPlanBySlug } from "@/server/billing/plans";
import { getActiveIntegration } from "@/server/config/platform-config-service";
import { createStripeSubscriptionCheckout } from "@/server/payments/providers/stripe/stripe-adapter";
import {
  beginOAuthFlow,
  completeSocialOnboarding,
  createOAuthStatePayload,
  finishOAuthCallback,
  getOAuthUserFacingErrorMessage,
  listVisibleSocialAuthProviders,
  verifyOAuthStatePayload,
} from "@/server/auth/oauth-service";

describe("social auth service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cookieState.clear();
    vi.stubGlobal("fetch", vi.fn());
    mockPrisma.platformIntegration.findFirst.mockResolvedValue(null);
    vi.mocked(getActiveBillingPlanBySlug).mockResolvedValue(null);
    vi.mocked(createStripeSubscriptionCheckout).mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/c/pay_123",
    });
    Object.assign(mockEnv, {
      APP_URL: "https://app.nizamkitchen.test",
      NODE_ENV: "test",
      DEPLOYMENT_ENVIRONMENT: "local",
      GOOGLE_OAUTH_CLIENT_ID: "env-google-client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "env-google-client-secret",
      GOOGLE_OAUTH_CALLBACK_URL: "",
      FACEBOOK_OAUTH_APP_ID: "",
      FACEBOOK_OAUTH_APP_SECRET: "",
      FACEBOOK_OAUTH_CALLBACK_URL: "",
    });
  });

  it("wires visible social providers into the public login page", async () => {
    const loginPage = await fs.readFile("src/app/(public)/login/page.tsx", "utf8");

    expect(loginPage).toContain('listVisibleSocialAuthProvidersSafe("login")');
    expect(loginPage).toContain("<SocialAuthButtons");
  });

  it("shows social auth buttons and marks unconfigured/disabled providers clearly", async () => {
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

    expect(loginProviders.map((provider) => provider.provider)).toEqual(["google", "facebook"]);
    expect(loginProviders.find((provider) => provider.provider === "google")?.configured).toBe(true);
    expect(loginProviders.find((provider) => provider.provider === "facebook")?.configured).toBe(false);
    expect(loginProviders.find((provider) => provider.provider === "facebook")?.setupMessage).toContain("Facebook sign-in is not configured yet");
    expect(registerProviders.map((provider) => provider.provider)).toEqual(["google", "facebook"]);
    expect(registerProviders.find((provider) => provider.provider === "google")?.configured).toBe(false);
    expect(registerProviders.find((provider) => provider.provider === "google")?.setupMessage).toContain("Google registration is not enabled yet");
  });

  it("generates and verifies OAuth state while blocking open redirects", () => {
    const payload = createOAuthStatePayload("login", "//evil.example.com");
    expect(payload.redirectTo).toBeNull();
    expect(verifyOAuthStatePayload(payload, payload.state)).toBe(true);
    expect(verifyOAuthStatePayload(payload, "wrong-state")).toBe(false);
  });

  it("falls back to environment OAuth credentials when the configuration vault is unavailable", async () => {
    vi.mocked(getActiveIntegration).mockRejectedValue(new Error("Database unavailable"));

    const authorizationUrl = await beginOAuthFlow({ provider: "google", flow: "register" });
    const parsedUrl = new URL(authorizationUrl);

    expect(parsedUrl.hostname).toBe("accounts.google.com");
    expect(parsedUrl.searchParams.get("client_id")).toBe("env-google-client-id");
    expect(parsedUrl.searchParams.get("redirect_uri")).toBe("https://app.nizamkitchen.test/api/auth/oauth/google/callback");
  });

  it("hides a social sign-in provider when Platform Owner disables its API record", async () => {
    mockPrisma.platformIntegration.findFirst.mockImplementation(async ({ where }: { where: { provider: string } }) => {
      if (where.provider === "google_oauth") {
        return { id: "google-auth", status: "disabled" };
      }
      return null;
    });
    vi.mocked(getActiveIntegration).mockResolvedValue(null);

    const loginProviders = await listVisibleSocialAuthProviders("login");

    expect(loginProviders.map((provider) => provider.provider)).toEqual(["facebook"]);
    expect(loginProviders.find((provider) => provider.provider === "google")).toBeUndefined();
  });

  it("does not fall back to environment OAuth credentials when a vault record is active but incomplete", async () => {
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth-incomplete",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
      ],
      settings: [
        { settingKey: "callbackUrl", settingValueJson: "https://app.nizamkitchen.test/api/auth/oauth/google/callback", isSecret: false },
      ],
    } as never);

    await expect(beginOAuthFlow({ provider: "google", flow: "register" }))
      .rejects
      .toThrow("Google sign-up is not configured yet.");
  });

  it("uses the real callback URL even if an OAuth API record accidentally stores the start URL", async () => {
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
        { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
      ],
      settings: [
        {
          settingKey: "callbackUrl",
          settingValueJson: "https://app.nizamkitchen.test/api/auth/oauth/google/start?flow=register",
          isSecret: false,
        },
      ],
    } as never);

    const authorizationUrl = await beginOAuthFlow({ provider: "google", flow: "register" });
    const redirectUri = new URL(authorizationUrl).searchParams.get("redirect_uri");

    expect(redirectUri).toBe("https://app.nizamkitchen.test/api/auth/oauth/google/callback");
  });

  it("uses the production request origin when a saved OAuth callback still points at localhost", async () => {
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
        { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
      ],
      settings: [
        {
          settingKey: "callbackUrl",
          settingValueJson: "http://localhost:3000/api/auth/oauth/google/callback",
          isSecret: false,
        },
      ],
    } as never);

    const authorizationUrl = await beginOAuthFlow({
      provider: "google",
      flow: "login",
      requestOrigin: "https://nk.friscodawah.org",
    });
    const redirectUri = new URL(authorizationUrl).searchParams.get("redirect_uri");

    expect(redirectUri).toBe("https://nk.friscodawah.org/api/auth/oauth/google/callback");
  });

  it("uses APP_URL in production even when request origin and saved callback are localhost", async () => {
    Object.assign(mockEnv, {
      APP_URL: "https://nk.friscodawah.org",
      NODE_ENV: "production",
      DEPLOYMENT_ENVIRONMENT: "production",
    });
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
        { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
      ],
      settings: [
        {
          settingKey: "callbackUrl",
          settingValueJson: "http://localhost:3000/api/auth/oauth/google/callback",
          isSecret: false,
        },
      ],
    } as never);

    const authorizationUrl = await beginOAuthFlow({
      provider: "google",
      flow: "login",
      requestOrigin: "http://localhost:3000",
    });
    const redirectUri = new URL(authorizationUrl).searchParams.get("redirect_uri");

    expect(redirectUri).toBe("https://nk.friscodawah.org/api/auth/oauth/google/callback");
    expect(redirectUri).not.toContain("localhost");
  });

  it("refuses to generate a localhost OAuth callback in production", async () => {
    Object.assign(mockEnv, {
      APP_URL: "http://localhost:3000",
      NODE_ENV: "production",
      DEPLOYMENT_ENVIRONMENT: "production",
    });
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
        { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
      ],
      settings: [],
    } as never);

    await expect(beginOAuthFlow({ provider: "google", flow: "login" }))
      .rejects
      .toThrow("Production Google OAuth callback is misconfigured");
  });

  it("turns Google token exchange failures into setup guidance without exposing secrets", async () => {
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
        { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
      ],
      settings: [
        {
          settingKey: "callbackUrl",
          settingValueJson: "https://nk.friscodawah.org/api/auth/oauth/google/callback",
          isSecret: false,
        },
      ],
    } as never);

    await beginOAuthFlow({
      provider: "google",
      flow: "login",
      requestOrigin: "https://nk.friscodawah.org",
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        {
          error: "invalid_grant",
          error_description: "Bad Request: redirect_uri mismatch",
        },
        { status: 400 },
      ),
    );

    const state = JSON.parse(cookieState.get("nk_oauth_state_google") ?? "{}").state;
    let caught: unknown;

    try {
      await finishOAuthCallback({
        provider: "google",
        requestUrl: `https://nk.friscodawah.org/api/auth/oauth/google/callback?code=test-code&state=${state}`,
        requestOrigin: "https://nk.friscodawah.org",
      });
    } catch (error) {
      caught = error;
    }

    const message = getOAuthUserFacingErrorMessage(caught, "Unable to complete Google sign-in.");

    expect(message).toContain("Google rejected the callback URL");
    expect(message).not.toContain("google-secret");
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.oauth_failed",
        details: expect.objectContaining({
          providerErrorCode: "invalid_grant",
          callbackUrlHost: "nk.friscodawah.org",
        }),
      }),
    );
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
          avatarUrl: "https://example.com/avatar.png",
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

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oauthAccounts: expect.objectContaining({
            create: expect.objectContaining({
              provider: "facebook",
              avatarUrl: "https://example.com/avatar.png",
            }),
          }),
        }),
      }),
    );
    expect(redirectPath).toBe("/onboarding/social?type=catering");
  });

  it("preserves paid pricing plan selection through social sign-up onboarding", async () => {
    vi.mocked(getActiveIntegration).mockResolvedValue({
      id: "google-auth",
      credentials: [
        { keyName: "client_id", value: "google-client-id", isPublicClientValue: true },
        { keyName: "client_secret", value: "google-secret", isPublicClientValue: false },
      ],
      settings: [
        { settingKey: "autoCreateUser", settingValueJson: true, isSecret: false },
      ],
    } as never);

    await beginOAuthFlow({
      provider: "google",
      flow: "register",
      selectedPlanSlug: "family-plus",
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ access_token: "google-access-token" }))
      .mockResolvedValueOnce(
        Response.json({
          sub: "google-user-789",
          email: "new-family@example.test",
          email_verified: true,
          name: "New Family",
        }),
      );

    mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-new",
      email: "new-family@example.test",
      fullName: "New Family",
      platformRole: null,
      status: "active",
    });
    mockPrisma.user.update.mockResolvedValue({ id: "user-new" });

    const redirectPath = await finishOAuthCallback({
      provider: "google",
      requestUrl: "https://app.nizamkitchen.test/api/auth/oauth/google/callback?code=test-code&state=" +
        JSON.parse(cookieState.get("nk_oauth_state_google") ?? "{}").state,
    });

    expect(redirectPath).toBe("/onboarding/social?type=household&plan=family-plus");
  });

  it("starts Stripe checkout after social onboarding when a paid plan was selected", async () => {
    const country = {
      countryCode: "US",
      currencyCode: "USD",
      defaultTimezone: "America/Chicago",
      defaultLocale: "en-US",
      measurementSystem: "imperial",
      isActive: true,
    };
    const user = {
      id: "user-social",
      email: "family@example.test",
      fullName: "Family User",
      platformRole: null,
      status: "active",
    };
    const organization = {
      id: "org-social",
      countryCode: "US",
    };
    const tx = {
      user: { update: vi.fn(async () => user) },
      organization: { create: vi.fn(async () => organization) },
      membership: { create: vi.fn() },
      householdProfile: { create: vi.fn() },
      chefProfile: { create: vi.fn() },
      homeCateringProfile: { create: vi.fn() },
    };

    mockPrisma.country.findUnique.mockResolvedValue(country);
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(tx));
    mockPrisma.session.update.mockResolvedValue({ id: "session-1" });
    vi.mocked(getActiveBillingPlanBySlug).mockResolvedValue({
      id: "plan-family-plus",
      priceAmount: 4.99,
    } as never);

    const destination = await completeSocialOnboarding({
      userId: "user-social",
      sessionId: "session-1",
      fullName: "Family User",
      accountType: "household",
      organizationName: "Family Kitchen",
      countryCode: "US",
      selectedPlanSlug: "family-plus",
    });

    expect(destination).toBe("https://checkout.stripe.com/c/pay_123");
    expect(createStripeSubscriptionCheckout).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-social",
      userId: "user-social",
      planId: "plan-family-plus",
    }));
  });

  it("skips Stripe checkout after social onboarding when a free plan was selected", async () => {
    const country = {
      countryCode: "US",
      currencyCode: "USD",
      defaultTimezone: "America/Chicago",
      defaultLocale: "en-US",
      measurementSystem: "imperial",
      isActive: true,
    };
    const user = {
      id: "user-social",
      email: "family@example.test",
      fullName: "Family User",
      platformRole: null,
      status: "active",
    };
    const organization = {
      id: "org-social",
      countryCode: "US",
    };
    const tx = {
      user: { update: vi.fn(async () => user) },
      organization: { create: vi.fn(async () => organization) },
      membership: { create: vi.fn() },
      householdProfile: { create: vi.fn() },
      chefProfile: { create: vi.fn() },
      homeCateringProfile: { create: vi.fn() },
    };

    mockPrisma.country.findUnique.mockResolvedValue(country);
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(tx));
    mockPrisma.session.update.mockResolvedValue({ id: "session-1" });
    vi.mocked(getActiveBillingPlanBySlug).mockResolvedValue({
      id: "plan-household-free",
      priceAmount: 0,
    } as never);

    const destination = await completeSocialOnboarding({
      userId: "user-social",
      sessionId: "session-1",
      fullName: "Family User",
      accountType: "household",
      organizationName: "Family Kitchen",
      countryCode: "US",
      selectedPlanSlug: "household-free",
    });

    expect(destination).toBe("/household/preferences?message=Your+free+account+is+ready.+Welcome+to+NizamKitchen.&analytics_event=sign_up");
    expect(createStripeSubscriptionCheckout).not.toHaveBeenCalled();
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
    ).rejects.toThrow("Google sign-in could not be verified.");
  });

  it("keeps admin OAuth pages server-side protected and avoids open redirect code", async () => {
    const categoriesPage = await fs.readFile("src/app/(app)/admin/apis/categories/page.tsx", "utf8");
    const detailPage = await fs.readFile("src/app/(app)/admin/apis/[id]/page.tsx", "utf8");
    const googleStartRoute = await fs.readFile("src/app/api/auth/oauth/google/start/route.ts", "utf8");
    const callbackRoute = await fs.readFile("src/app/api/auth/oauth/google/callback/route.ts", "utf8");

    expect(categoriesPage).toContain("requirePlatformRole([\"platform_owner\"])");
    expect(detailPage).toContain("requirePlatformRole([\"platform_owner\"])");
    expect(googleStartRoute).not.toContain("canonicalOrigin");
    expect(googleStartRoute).toContain("publicRedirectUrl");
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
