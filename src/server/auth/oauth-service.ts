import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  IntegrationProvider,
  OAuthProvider,
  OrganizationType,
  type Prisma,
  type User,
} from "@prisma/client";
import { assertUserCanAuthenticate } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { generateOpaqueToken } from "@/lib/security.server";
import { createSession, getRequestMetadata } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { createAuditEvent } from "@/server/audit";
import { getActiveIntegration } from "@/server/config/platform-config-service";
import { createAcceptance, getRequiredLegalDocumentsForUser } from "@/server/legal/legal-service";

export type SocialAuthProvider = "google" | "facebook";
export type SocialAuthFlow = "login" | "register";
export type SocialAccountType = "household" | "chef" | "catering" | "restaurant";

type OAuthProviderConfig = {
  integrationId: string;
  provider: SocialAuthProvider;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  allowedDomains: string[];
  autoCreateUser: boolean;
  loginButtonVisible: boolean;
  defaultOrganizationType: OrganizationType | null;
};

type OAuthStatePayload = {
  state: string;
  flow: SocialAuthFlow;
  redirectTo: string | null;
};

type NormalizedOAuthProfile = {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  rawProfileJson: Prisma.JsonObject;
};

type LinkedOAuthUser = {
  user: Pick<User, "id" | "email" | "platformRole" | "status">;
  activeOrganizationId: string | null;
  isNewUser: boolean;
  organizationCount: number;
};

const OAUTH_STATE_COOKIE_PREFIX = "nk_oauth_state_";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const ACCOUNT_TYPE_TO_ORG: Record<SocialAccountType, OrganizationType> = {
  household: "household",
  chef: "chef_business",
  catering: "home_catering",
  restaurant: "restaurant",
};

const ORG_TO_ACCOUNT_TYPE: Partial<Record<OrganizationType, SocialAccountType>> = {
  household: "household",
  chef_business: "chef",
  home_catering: "catering",
  restaurant: "restaurant",
};

const POST_REGISTER_DESTINATION: Record<SocialAccountType, string> = {
  household: "/household/preferences",
  chef: "/chef/profile",
  catering: "/catering/profile/setup",
  restaurant: "/restaurant",
};

function providerToIntegration(provider: SocialAuthProvider) {
  return provider === "google"
    ? IntegrationProvider.google_oauth
    : IntegrationProvider.facebook_oauth;
}

function defaultCallbackPath(provider: SocialAuthProvider) {
  return provider === "google"
    ? "/api/auth/oauth/google/callback"
    : "/api/auth/oauth/facebook/callback";
}

function stateCookieName(provider: SocialAuthProvider) {
  return `${OAUTH_STATE_COOKIE_PREFIX}${provider}`;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function asStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => `${item}`.trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function normalizeRedirectPath(value: string | null | undefined, fallback: string | null = null) {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\n") || value.includes("\r")) return fallback;
  return value;
}

function buildCallbackUrl(provider: SocialAuthProvider, configured: unknown) {
  if (typeof configured === "string" && configured.trim().startsWith("http")) {
    return configured.trim();
  }

  return new URL(defaultCallbackPath(provider), env.APP_URL).toString();
}

function providerDisplayName(provider: SocialAuthProvider) {
  return provider === "google" ? "Google" : "Facebook";
}

function loginDestination(platformRole: string | null, activeOrganizationId?: string | null) {
  if (activeOrganizationId) return "/dashboard";
  if (platformRole === "country_manager") return "/admin/my-countries";
  if (platformRole) return "/admin";
  return "/organizations";
}

function onboardingDestination(defaultOrganizationType: OrganizationType | null) {
  const query = ORG_TO_ACCOUNT_TYPE[defaultOrganizationType ?? "household"];
  return query ? `/onboarding/social?type=${query}` : "/onboarding/social";
}

async function readOAuthState(provider: SocialAuthProvider) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(stateCookieName(provider))?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OAuthStatePayload;
  } catch {
    return null;
  }
}

async function writeOAuthState(provider: SocialAuthProvider, payload: OAuthStatePayload) {
  const cookieStore = await cookies();
  cookieStore.set(stateCookieName(provider), JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: OAUTH_STATE_TTL_SECONDS,
    path: "/",
    priority: "high",
  });
}

async function clearOAuthState(provider: SocialAuthProvider) {
  const cookieStore = await cookies();
  cookieStore.set(stateCookieName(provider), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
    priority: "high",
  });
}

function normalizeDefaultOrganizationType(value: unknown) {
  if (typeof value !== "string") return null;

  if (value in ORG_TO_ACCOUNT_TYPE) {
    return value as OrganizationType;
  }

  if (value in ACCOUNT_TYPE_TO_ORG) {
    return ACCOUNT_TYPE_TO_ORG[value as SocialAccountType];
  }

  return null;
}

export async function getOAuthProviderConfig(provider: SocialAuthProvider) {
  const integration = await getActiveIntegration(providerToIntegration(provider));
  if (!integration) return null;

  const credentials = Object.fromEntries(
    integration.credentials.map((credential) => [credential.keyName, credential.value]),
  ) as Record<string, string | undefined>;
  const settings = Object.fromEntries(
    integration.settings.map((setting) => [setting.settingKey, setting.settingValueJson]),
  );

  const clientId =
    provider === "google" ? credentials.client_id : credentials.app_id;
  const clientSecret =
    provider === "google" ? credentials.client_secret : credentials.app_secret;

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    integrationId: integration.id,
    provider,
    clientId,
    clientSecret,
    callbackUrl: buildCallbackUrl(provider, settings.callbackUrl),
    allowedDomains: asStringList(settings.allowedDomains),
    autoCreateUser: asBoolean(settings.autoCreateUser, true),
    loginButtonVisible: asBoolean(settings.loginButtonVisible, true),
    defaultOrganizationType: normalizeDefaultOrganizationType(settings.defaultOrganizationType),
  } satisfies OAuthProviderConfig;
}

export async function listVisibleSocialAuthProviders(flow: SocialAuthFlow) {
  const providers = await Promise.all([
    getOAuthProviderConfig("google"),
    getOAuthProviderConfig("facebook"),
  ]);

  return providers
    .filter((config): config is OAuthProviderConfig => Boolean(config))
    .filter((config) => config.loginButtonVisible)
    .filter((config) => flow === "login" || config.autoCreateUser)
    .map((config) => ({
      provider: config.provider,
      label: providerDisplayName(config.provider),
      href: `/api/auth/oauth/${config.provider}/start?flow=${flow}`,
    }));
}

export async function listVisibleSocialAuthProvidersSafe(flow: SocialAuthFlow) {
  try {
    return await listVisibleSocialAuthProviders(flow);
  } catch {
    return [];
  }
}

function buildAuthorizationUrl(config: OAuthProviderConfig, state: string) {
  if (config.provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "select_account");
    return url.toString();
  }

  const url = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "email,public_profile");
  return url.toString();
}

export async function beginOAuthFlow(params: {
  provider: SocialAuthProvider;
  flow: SocialAuthFlow;
  redirectTo?: string | null;
}) {
  const config = await getOAuthProviderConfig(params.provider);
  if (!config) {
    throw new Error(`${providerDisplayName(params.provider)} login is not configured yet.`);
  }

  const state = generateOpaqueToken();
  await writeOAuthState(params.provider, {
    state,
    flow: params.flow,
    redirectTo: normalizeRedirectPath(params.redirectTo, null),
  });

  return buildAuthorizationUrl(config, state);
}

async function exchangeGoogleCode(config: OAuthProviderConfig, code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Google token exchange failed.");
  }

  return response.json() as Promise<{
    access_token: string;
  }>;
}

async function exchangeFacebookCode(config: OAuthProviderConfig, code: string) {
  const url = new URL("https://graph.facebook.com/v20.0/oauth/access_token");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("client_secret", config.clientSecret);
  url.searchParams.set("redirect_uri", config.callbackUrl);
  url.searchParams.set("code", code);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Facebook token exchange failed.");
  }

  return response.json() as Promise<{
    access_token: string;
  }>;
}

async function fetchGoogleProfile(accessToken: string): Promise<NormalizedOAuthProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Google profile lookup failed.");
  }

  const profile = (await response.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  return {
    providerAccountId: profile.sub,
    email: profile.email?.toLowerCase() ?? null,
    emailVerified: profile.email_verified === true,
    displayName: profile.name ?? null,
    avatarUrl: profile.picture ?? null,
    rawProfileJson: profile as Prisma.JsonObject,
  };
}

async function fetchFacebookProfile(accessToken: string): Promise<NormalizedOAuthProfile> {
  const url = new URL("https://graph.facebook.com/v20.0/me");
  url.searchParams.set("fields", "id,name,email,picture.type(large),verified,is_verified");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Facebook profile lookup failed.");
  }

  const profile = (await response.json()) as {
    id: string;
    email?: string;
    name?: string;
    verified?: boolean;
    is_verified?: boolean;
    picture?: { data?: { url?: string } };
  };

  return {
    providerAccountId: profile.id,
    email: profile.email?.toLowerCase() ?? null,
    emailVerified: profile.verified === true || profile.is_verified === true,
    displayName: profile.name ?? null,
    avatarUrl: profile.picture?.data?.url ?? null,
    rawProfileJson: profile as Prisma.JsonObject,
  };
}

async function fetchOAuthProfile(provider: SocialAuthProvider, config: OAuthProviderConfig, code: string) {
  if (provider === "google") {
    const tokens = await exchangeGoogleCode(config, code);
    return fetchGoogleProfile(tokens.access_token);
  }

  const tokens = await exchangeFacebookCode(config, code);
  return fetchFacebookProfile(tokens.access_token);
}

function isDomainAllowed(email: string | null, allowedDomains: string[]) {
  if (!allowedDomains.length) return true;
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return allowedDomains.includes(domain);
}

function providerCanLinkExistingUser(provider: SocialAuthProvider, profile: NormalizedOAuthProfile) {
  if (provider === "google") {
    return profile.emailVerified;
  }

  return profile.emailVerified;
}

async function linkOrCreateOAuthUser(params: {
  provider: SocialAuthProvider;
  config: OAuthProviderConfig;
  profile: NormalizedOAuthProfile;
}): Promise<LinkedOAuthUser> {
  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: params.provider as OAuthProvider,
        providerAccountId: params.profile.providerAccountId,
      },
    },
    include: {
      user: {
        include: {
          memberships: {
            where: { status: "active" },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (existingAccount) {
    await prisma.oAuthAccount.update({
      where: { id: existingAccount.id },
      data: {
        email: params.profile.email,
        emailVerified: params.profile.emailVerified,
        displayName: params.profile.displayName,
        avatarUrl: params.profile.avatarUrl,
        rawProfileJson: params.profile.rawProfileJson,
      },
    });

    return {
      user: existingAccount.user,
      activeOrganizationId: existingAccount.user.memberships[0]?.organizationId ?? null,
      isNewUser: false,
      organizationCount: existingAccount.user.memberships.length,
    };
  }

  if (!params.profile.email) {
    throw new Error(`${providerDisplayName(params.provider)} did not return an email address.`);
  }

  if (!isDomainAllowed(params.profile.email, params.config.allowedDomains)) {
    throw new Error("This email domain is not allowed for social sign-in.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: params.profile.email },
    include: {
      memberships: {
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (existingUser) {
    if (!providerCanLinkExistingUser(params.provider, params.profile)) {
      throw new Error("Use your existing password sign-in first, then ask an admin to link this account.");
    }

    const linkedAccount = await prisma.oAuthAccount.create({
      data: {
        userId: existingUser.id,
        provider: params.provider as OAuthProvider,
        providerAccountId: params.profile.providerAccountId,
        email: params.profile.email,
        emailVerified: params.profile.emailVerified,
        displayName: params.profile.displayName,
        avatarUrl: params.profile.avatarUrl,
        rawProfileJson: params.profile.rawProfileJson,
      },
    });

    await createAuditEvent({
      actorUserId: existingUser.id,
      organizationId: existingUser.memberships[0]?.organizationId ?? null,
      action: "user.oauth_linked",
      targetType: "oauth_account",
      targetId: linkedAccount.id,
      details: {
        provider: params.provider,
        verifiedEmail: params.profile.emailVerified,
      },
      ...(await getRequestMetadata()),
    });

    return {
      user: existingUser,
      activeOrganizationId: existingUser.memberships[0]?.organizationId ?? null,
      isNewUser: false,
      organizationCount: existingUser.memberships.length,
    };
  }

  if (!params.config.autoCreateUser) {
    throw new Error("No account was found for this social login.");
  }

  const passwordHash = await hashPassword(`${generateOpaqueToken()}Aa1!`);
  const user = await prisma.user.create({
    data: {
      email: params.profile.email,
      fullName: params.profile.displayName ?? params.profile.email.split("@")[0] ?? "NizamKitchen User",
      passwordHash,
      oauthAccounts: {
        create: {
          provider: params.provider as OAuthProvider,
          providerAccountId: params.profile.providerAccountId,
          email: params.profile.email,
          emailVerified: params.profile.emailVerified,
          displayName: params.profile.displayName,
          avatarUrl: params.profile.avatarUrl,
          rawProfileJson: params.profile.rawProfileJson,
        },
      },
    },
  });

  return {
    user,
    activeOrganizationId: null,
    isNewUser: true,
    organizationCount: 0,
  };
}

async function createOAuthFailureAudit(action: string, details: Prisma.InputJsonValue) {
  await createAuditEvent({
    action,
    targetType: "oauth",
    details,
    ...(await getRequestMetadata()),
  });
}

export async function finishOAuthCallback(params: {
  provider: SocialAuthProvider;
  requestUrl: string;
}) {
  const url = new URL(params.requestUrl);
  const stateParam = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");

  const savedState = await readOAuthState(params.provider);
  await clearOAuthState(params.provider);

  if (!savedState || !stateParam || savedState.state !== stateParam) {
    await createOAuthFailureAudit("user.oauth_failed", {
      provider: params.provider,
      reason: "invalid_state",
    });
    throw new Error("OAuth state verification failed.");
  }

  const config = await getOAuthProviderConfig(params.provider);
  if (!config) {
    await createOAuthFailureAudit("user.oauth_failed", {
      provider: params.provider,
      reason: "provider_not_configured",
    });
    throw new Error(`${providerDisplayName(params.provider)} login is not configured yet.`);
  }

  if (providerError) {
    await createOAuthFailureAudit("user.oauth_failed", {
      provider: params.provider,
      reason: providerError,
    });
    throw new Error(`${providerDisplayName(params.provider)} sign-in was cancelled.`);
  }

  if (!code) {
    await createOAuthFailureAudit("user.oauth_failed", {
      provider: params.provider,
      reason: "missing_code",
    });
    throw new Error("OAuth callback did not include an authorization code.");
  }

  let profile: NormalizedOAuthProfile;
  let result: LinkedOAuthUser;

  try {
    profile = await fetchOAuthProfile(params.provider, config, code);
    result = await linkOrCreateOAuthUser({
      provider: params.provider,
      config,
      profile,
    });
  } catch (error) {
    await createOAuthFailureAudit("user.oauth_failed", {
      provider: params.provider,
      reason: error instanceof Error ? error.message : "oauth_processing_failed",
    });
    throw error;
  }

  try {
    assertUserCanAuthenticate(result.user);
  } catch (error) {
    await createOAuthFailureAudit("user.oauth_failed", {
      provider: params.provider,
      reason: error instanceof Error ? error.message : "user_not_active",
      userId: result.user.id,
    });
    throw error;
  }
  await createSession(result.user.id, result.activeOrganizationId);
  await prisma.user.update({
    where: { id: result.user.id },
    data: { lastLoginAt: new Date() },
  });

  const auditAction = result.isNewUser ? "user.oauth_registered" : "user.oauth_login";
  await createAuditEvent({
    actorUserId: result.user.id,
    organizationId: result.activeOrganizationId,
    action: auditAction,
    targetType: "oauth_account",
    targetId: result.user.id,
    details: {
      provider: params.provider,
      linkedByVerifiedEmail: Boolean(profile.email && profile.emailVerified),
      organizationCount: result.organizationCount,
    },
    ...(await getRequestMetadata()),
  });

  if (result.organizationCount === 0 && !result.user.platformRole) {
    return onboardingDestination(config.defaultOrganizationType);
  }

  const redirectTo = normalizeRedirectPath(savedState.redirectTo, null);
  if (redirectTo) {
    return redirectTo;
  }

  return loginDestination(result.user.platformRole, result.activeOrganizationId);
}

export async function completeSocialOnboarding(params: {
  userId: string;
  sessionId: string;
  fullName: string;
  accountType: SocialAccountType;
  organizationName: string;
  countryCode: string;
}) {
  const fullName = params.fullName.trim();
  const organizationName = params.organizationName.trim();

  if (fullName.length < 2) {
    throw new Error("Enter your full name.");
  }

  if (organizationName.length < 2) {
    throw new Error("Enter a valid organization or household name.");
  }

  const organizationType = ACCOUNT_TYPE_TO_ORG[params.accountType];

  const country = await prisma.country.findUnique({
    where: { countryCode: params.countryCode.toUpperCase() },
  });

  if (!country || !country.isActive) {
    throw new Error("Invalid country selected.");
  }

  const slugBase = `${slugify(organizationName)}-${Math.random().toString(36).slice(2, 8)}`;

  const { user, organization } = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: params.userId },
      data: { fullName },
    });

    const createdOrganization = await tx.organization.create({
      data: {
        name: organizationName,
        slug: slugBase,
        organizationType,
        organizationId: crypto.randomUUID(),
        countryCode: country.countryCode,
        currencyCode: country.currencyCode,
        defaultTimezone: country.defaultTimezone,
        defaultLocale: country.defaultLocale,
        measurementSystem: country.measurementSystem,
      },
    });

    await tx.membership.create({
      data: {
        userId: updatedUser.id,
        organizationId: createdOrganization.id,
        role: "org_owner",
        status: "active",
      },
    });

    if (organizationType === OrganizationType.household) {
      await tx.householdProfile.create({
        data: {
          organizationId: createdOrganization.id,
          countryCode: country.countryCode,
          displayName: organizationName,
          defaultHouseholdSize: 4,
          defaultServings: 4,
          defaultSpiceLevel: "medium",
          preferredMeasurementSystem: country.measurementSystem,
          preferredCuisineIds: [],
          cookingSkillLevel: "beginner",
          weeklyCookingDays: [],
        },
      });
    } else if (organizationType === OrganizationType.home_catering) {
      await tx.homeCateringProfile.create({
        data: {
          organizationId: createdOrganization.id,
          countryCode: country.countryCode,
          displayName: organizationName,
          slug: `${slugify(organizationName)}-${Math.random().toString(36).slice(2, 8)}`,
          cuisineSpecialtiesJson: [],
          languagesJson: [],
          acceptsPickup: true,
          acceptsDelivery: false,
          acceptsPreorders: true,
        },
      });
    }

    return { user: updatedUser, organization: createdOrganization };
  });

  await prisma.session.update({
    where: { id: params.sessionId },
    data: { activeOrganizationId: organization.id },
  });

  const requestMeta = await getRequestMetadata();
  await createAuditEvent({
    actorUserId: user.id,
    organizationId: organization.id,
    countryCode: organization.countryCode,
    action: "organization.created",
    targetType: "organization",
    targetId: organization.id,
    details: { organizationType },
    ...requestMeta,
  });
  await createAuditEvent({
    actorUserId: user.id,
    organizationId: organization.id,
    countryCode: organization.countryCode,
    action: "membership.created",
    targetType: "membership",
    targetId: user.id,
    details: { role: "org_owner" },
    ...requestMeta,
  });

  const requiredLegalDocuments = await getRequiredLegalDocumentsForUser({
    user,
    activeOrganization: organization,
  });
  await Promise.all(
    requiredLegalDocuments.map((document) =>
      createAcceptance({
        userId: user.id,
        organizationId: organization.id,
        documentId: document.id,
        ...requestMeta,
      }),
    ),
  );

  return POST_REGISTER_DESTINATION[params.accountType] ?? "/dashboard";
}

export function createOAuthStatePayload(flow: SocialAuthFlow, redirectTo?: string | null) {
  return {
    state: generateOpaqueToken(),
    flow,
    redirectTo: normalizeRedirectPath(redirectTo, null),
  } satisfies OAuthStatePayload;
}

export function verifyOAuthStatePayload(saved: OAuthStatePayload | null, state: string | null) {
  return Boolean(saved && state && saved.state === state);
}
