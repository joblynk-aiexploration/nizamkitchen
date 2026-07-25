import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  IntegrationStatus,
  IntegrationProvider,
  OAuthProvider,
  OrganizationType,
  type Prisma,
  type User,
} from "@prisma/client";
import {
  getOAuthCallbackPath,
  getOAuthCallbackUrl,
  getSafeRedirectUrl,
  isLocalhostUrl,
  isProductionRuntime,
} from "@/lib/app-url";
import { assertUserCanAuthenticate } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { generateOpaqueToken } from "@/lib/security.server";
import { createSession, getRequestMetadata } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { createAuditEvent } from "@/server/audit";
import { getActiveBillingPlanBySlug } from "@/server/billing/plans";
import { getActiveIntegration } from "@/server/config/platform-config-service";
import { createAcceptance, getRequiredLegalDocumentsForUser } from "@/server/legal/legal-service";
import { createStripeSubscriptionCheckout } from "@/server/payments/providers/stripe/stripe-adapter";

export type SocialAuthProvider = "google" | "facebook";
export type SocialAuthFlow = "login" | "register";
export type SocialAccountType = "household" | "chef" | "catering" | "restaurant";
export type VisibleSocialAuthProvider = {
  provider: SocialAuthProvider;
  label: string;
  href: string;
  configured: boolean;
  setupMessage?: string;
};

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
  selectedPlanSlug?: string | null;
};

type OAuthStateCookie = OAuthStatePayload | { states: OAuthStatePayload[] };

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

type OAuthUserWithMemberships = Pick<User, "id" | "email" | "platformRole" | "status"> & {
  memberships: Array<{ organizationId: string }>;
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

const FREE_ACCOUNT_READY_MESSAGE = "Your free account is ready. Welcome to NizamKitchen.";
const PLAN_UNAVAILABLE_MESSAGE = "Your account is ready, but that pricing plan is no longer available. You can choose another plan from Billing when you are ready.";
const CHECKOUT_UNAVAILABLE_MESSAGE = "Your account is ready. We could not open secure checkout right now, but you can continue and choose a paid plan from Billing anytime.";

function providerToIntegration(provider: SocialAuthProvider) {
  return provider === "google"
    ? IntegrationProvider.google_oauth
    : IntegrationProvider.facebook_oauth;
}

function defaultCallbackPath(provider: SocialAuthProvider) {
  return getOAuthCallbackPath(provider);
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
  return getSafeRedirectUrl(value, fallback);
}

function normalizeSelectedPlanSlug(value: string | null | undefined) {
  const plan = value?.trim();
  if (!plan || plan === "free") return null;
  return plan;
}

function pathWithMessage(destination: string, message: string) {
  const url = new URL(destination, env.APP_URL);
  url.searchParams.set("message", message);
  url.searchParams.set("analytics_event", "sign_up");
  return `${url.pathname}${url.search}`;
}

async function getCheckoutDestinationForPlan(params: {
  selectedPlanSlug?: string | null;
  organizationId: string;
  userId: string;
  fallbackDestination: string;
}) {
  if (params.selectedPlanSlug?.trim() === "free") {
    return pathWithMessage(params.fallbackDestination, FREE_ACCOUNT_READY_MESSAGE);
  }
  const selectedPlanSlug = normalizeSelectedPlanSlug(params.selectedPlanSlug);
  if (!selectedPlanSlug) return params.fallbackDestination;

  const plan = await getActiveBillingPlanBySlug(selectedPlanSlug);
  if (!plan) {
    return `/billing/plans?message=${encodeURIComponent(PLAN_UNAVAILABLE_MESSAGE)}`;
  }
  if (Number(plan.priceAmount) <= 0) {
    return pathWithMessage(params.fallbackDestination, FREE_ACCOUNT_READY_MESSAGE);
  }

  try {
    const checkout = await createStripeSubscriptionCheckout({
      organizationId: params.organizationId,
      userId: params.userId,
      planId: plan.id,
      appUrl: env.APP_URL,
    });

    if (checkout.checkoutUrl) {
      return checkout.checkoutUrl;
    }
  } catch (error) {
    console.error("Unable to start checkout after registration", error);
  }

  return `/billing/plans?message=${encodeURIComponent(CHECKOUT_UNAVAILABLE_MESSAGE)}`;
}

function buildCallbackUrl(provider: SocialAuthProvider, configured: unknown, requestOrigin?: string | null) {
  const generated = getOAuthCallbackUrl(provider, requestOrigin);

  if (isProductionRuntime()) {
    return generated;
  }

  if (typeof configured === "string" && configured.trim().startsWith("http")) {
    try {
      const callbackUrl = new URL(configured.trim());
      if (callbackUrl.pathname === defaultCallbackPath(provider)) {
        if (requestOrigin && isLocalhostUrl(callbackUrl.origin) && !isLocalhostUrl(requestOrigin)) {
          return getOAuthCallbackUrl(provider, requestOrigin);
        }
        return callbackUrl.toString();
      }
    } catch {
      return generated;
    }
  }

  return generated;
}

class OAuthProviderExchangeError extends Error {
  constructor(
    message: string,
    public readonly provider: SocialAuthProvider,
    public readonly providerErrorCode?: string,
    public readonly providerErrorDescription?: string,
  ) {
    super(message);
    this.name = "OAuthProviderExchangeError";
  }
}

function providerDisplayName(provider: SocialAuthProvider) {
  return provider === "google" ? "Google" : "Facebook";
}

function providerSetupMessage(provider: SocialAuthProvider, flow: SocialAuthFlow = "login") {
  const action = flow === "register" ? "sign-up" : "sign-in";
  return `${providerDisplayName(provider)} ${action} is not configured yet. Platform Owner can add the ${providerDisplayName(provider)} OAuth API in Admin > API Management.`;
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

function onboardingDestinationWithPlan(
  defaultOrganizationType: OrganizationType | null,
  selectedPlanSlug?: string | null,
) {
  const destination = onboardingDestination(defaultOrganizationType);
  const plan = normalizeSelectedPlanSlug(selectedPlanSlug);
  if (!plan) return destination;

  const url = new URL(destination, env.APP_URL);
  url.searchParams.set("plan", plan);
  return `${url.pathname}${url.search}`;
}

function normalizeOAuthStates(value: OAuthStateCookie | null) {
  if (!value) return [];
  if ("states" in value && Array.isArray(value.states)) {
    return value.states;
  }

  if ("state" in value) {
    return [value];
  }

  return [];
}

async function readOAuthStates(provider: SocialAuthProvider) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(stateCookieName(provider))?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OAuthStateCookie;
  } catch {
    return null;
  }
}

async function readOAuthState(provider: SocialAuthProvider, state?: string | null) {
  const states = normalizeOAuthStates(await readOAuthStates(provider));
  if (!state) return states.at(-1) ?? null;
  return states.find((payload) => payload.state === state) ?? null;
}

async function writeOAuthState(provider: SocialAuthProvider, payload: OAuthStatePayload) {
  const cookieStore = await cookies();
  const existingStates = normalizeOAuthStates(await readOAuthStates(provider));
  const states = [
    ...existingStates.filter((state) => state.state !== payload.state),
    payload,
  ].slice(-5);
  const cookieValue = states.length === 1 ? states[0] : { states };

  cookieStore.set(stateCookieName(provider), JSON.stringify(cookieValue), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: OAUTH_STATE_TTL_SECONDS,
    path: "/",
    priority: "high",
  });
}

async function clearOAuthState(provider: SocialAuthProvider, state?: string | null) {
  const cookieStore = await cookies();
  const remainingStates = normalizeOAuthStates(await readOAuthStates(provider)).filter(
    (payload) => !state || payload.state !== state,
  );

  if (remainingStates.length) {
    cookieStore.set(stateCookieName(provider), JSON.stringify({ states: remainingStates }), {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: OAUTH_STATE_TTL_SECONDS,
      path: "/",
      priority: "high",
    });
    return;
  }

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

function getEnvOAuthProviderConfig(provider: SocialAuthProvider, requestOrigin?: string | null) {
  const clientId = provider === "google" ? env.GOOGLE_OAUTH_CLIENT_ID : env.FACEBOOK_OAUTH_APP_ID;
  const clientSecret =
    provider === "google" ? env.GOOGLE_OAUTH_CLIENT_SECRET : env.FACEBOOK_OAUTH_APP_SECRET;
  const callbackUrl =
    provider === "google" ? env.GOOGLE_OAUTH_CALLBACK_URL : env.FACEBOOK_OAUTH_CALLBACK_URL;

  if (!clientId || !clientSecret) return null;

  return {
    integrationId: `env-${provider}-oauth`,
    provider,
    clientId,
    clientSecret,
    callbackUrl: buildCallbackUrl(provider, callbackUrl, requestOrigin),
    allowedDomains: [],
    autoCreateUser: true,
    loginButtonVisible: true,
    defaultOrganizationType: null,
  } satisfies OAuthProviderConfig;
}

export async function getOAuthProviderConfig(provider: SocialAuthProvider, requestOrigin?: string | null) {
  const envConfig = getEnvOAuthProviderConfig(provider, requestOrigin);
  let integration: Awaited<ReturnType<typeof getActiveIntegration>> = null;
  const integrationProvider = providerToIntegration(provider);

  try {
    const vaultRecord = await prisma.platformIntegration.findFirst({
      where: { provider: integrationProvider },
      select: { id: true, status: true },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    });

    if (vaultRecord && vaultRecord.status !== IntegrationStatus.active) {
      return null;
    }

    integration = await getActiveIntegration(integrationProvider);

    if (vaultRecord && !integration) {
      return null;
    }
  } catch {
    return envConfig;
  }

  if (!integration) {
    return envConfig;
  }

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
    return integration ? null : envConfig;
  }

  return {
    integrationId: integration.id,
    provider,
    clientId,
    clientSecret,
    callbackUrl: buildCallbackUrl(provider, settings.callbackUrl, requestOrigin),
    allowedDomains: asStringList(settings.allowedDomains),
    autoCreateUser: asBoolean(settings.autoCreateUser, true),
    loginButtonVisible: asBoolean(settings.loginButtonVisible, true),
    defaultOrganizationType: normalizeDefaultOrganizationType(settings.defaultOrganizationType),
  } satisfies OAuthProviderConfig;
}

async function isOAuthProviderExplicitlyDisabled(provider: SocialAuthProvider) {
  try {
    const integration = await prisma.platformIntegration.findFirst({
      where: { provider: providerToIntegration(provider) },
      select: { status: true },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return integration?.status === IntegrationStatus.disabled;
  } catch {
    return false;
  }
}

export async function listVisibleSocialAuthProviders(flow: SocialAuthFlow): Promise<VisibleSocialAuthProvider[]> {
  const providers = await Promise.all([
    getOAuthProviderConfig("google"),
    getOAuthProviderConfig("facebook"),
  ]);
  const explicitlyDisabled = await Promise.all([
    isOAuthProviderExplicitlyDisabled("google"),
    isOAuthProviderExplicitlyDisabled("facebook"),
  ]);

  return (["google", "facebook"] as const)
    .map((provider, index) => {
      const config = providers[index];
      const label = providerDisplayName(provider);
      const href = `/api/auth/oauth/${provider}/start?flow=${flow}`;

      if (explicitlyDisabled[index]) return null;

      if (!config) {
        return {
          provider,
          label,
          href,
          configured: false,
          setupMessage: providerSetupMessage(provider, flow),
        };
      }

      if (!config.loginButtonVisible) return null;
      if (flow === "register" && !config.autoCreateUser) {
        return {
          provider,
          label,
          href,
          configured: false,
          setupMessage: `${label} registration is not enabled yet. Platform Owner can enable account creation in Admin > API Management.`,
        };
      }

      return {
        provider: config.provider,
        label,
        href,
        configured: true,
      };
    })
    .filter((provider): provider is VisibleSocialAuthProvider => Boolean(provider));
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
  selectedPlanSlug?: string | null;
  requestOrigin?: string | null;
}) {
  const config = await getOAuthProviderConfig(params.provider, params.requestOrigin);
  if (!config) {
    throw new Error(providerSetupMessage(params.provider, params.flow));
  }

  const state = generateOpaqueToken();
  await writeOAuthState(params.provider, {
    state,
    flow: params.flow,
    redirectTo: normalizeRedirectPath(params.redirectTo, null),
    selectedPlanSlug: normalizeSelectedPlanSlug(params.selectedPlanSlug),
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
    const body = await response.json().catch(() => ({})) as {
      error?: string;
      error_description?: string;
    };
    throw new OAuthProviderExchangeError(
      "Google could not verify this sign-in setup. Please check the saved Google OAuth client ID, client secret, and callback URL in API Management.",
      "google",
      body.error,
      body.error_description,
    );
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
    const body = await response.json().catch(() => ({})) as {
      error?: { message?: string; code?: string | number; type?: string };
    };
    throw new OAuthProviderExchangeError(
      "Facebook could not verify this sign-in setup. Please check the saved Facebook app ID, app secret, and callback URL in API Management.",
      "facebook",
      body.error?.code ? `${body.error.code}` : body.error?.type,
      body.error?.message,
    );
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

async function recoverIncompleteSocialSignup(user: OAuthUserWithMemberships) {
  if (user.status !== "disabled" || user.platformRole || user.memberships.length > 0) {
    return user;
  }

  return prisma.user.update({
    where: { id: user.id },
    data: { status: "active" },
    include: {
      memberships: {
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

async function linkOrCreateOAuthUser(params: {
  provider: SocialAuthProvider;
  config: OAuthProviderConfig;
  profile: NormalizedOAuthProfile;
  flow: SocialAuthFlow;
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
    const accountUser =
      params.flow === "register"
        ? await recoverIncompleteSocialSignup(existingAccount.user)
        : existingAccount.user;

    if (accountUser.status !== "active") {
      throw new Error(
        `${providerDisplayName(params.provider)} found an existing account, but that account is currently ${accountUser.status}. Ask the Platform Owner to reactivate it, or sign up with a different email address.`,
      );
    }

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
      user: accountUser,
      activeOrganizationId: accountUser.memberships[0]?.organizationId ?? null,
      isNewUser: false,
      organizationCount: accountUser.memberships.length,
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
    const accountUser =
      params.flow === "register"
        ? await recoverIncompleteSocialSignup(existingUser)
        : existingUser;

    if (accountUser.status !== "active") {
      throw new Error(
        `${providerDisplayName(params.provider)} found an existing account for ${params.profile.email}, but that account is currently ${accountUser.status}. Ask the Platform Owner to reactivate it, or sign up with a different email address.`,
      );
    }

    if (!providerCanLinkExistingUser(params.provider, params.profile)) {
      throw new Error("Use your existing password sign-in first, then ask an admin to link this account.");
    }

    const linkedAccount = await prisma.oAuthAccount.create({
      data: {
        userId: accountUser.id,
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
      actorUserId: accountUser.id,
      organizationId: accountUser.memberships[0]?.organizationId ?? null,
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
      user: accountUser,
      activeOrganizationId: accountUser.memberships[0]?.organizationId ?? null,
      isNewUser: false,
      organizationCount: accountUser.memberships.length,
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
      status: "active",
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
  requestOrigin?: string | null;
}) {
  const url = new URL(params.requestUrl);
  const stateParam = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");

  const savedState = await readOAuthState(params.provider, stateParam);

  if (!savedState || !stateParam || savedState.state !== stateParam) {
    await createOAuthFailureAudit("user.oauth_failed", {
      provider: params.provider,
      reason: "invalid_state",
    });
    throw new Error(
      `${providerDisplayName(params.provider)} sign-in could not be verified. Please start again from the sign-in or sign-up page in the same browser.`,
    );
  }

  await clearOAuthState(params.provider, stateParam);

  const config = await getOAuthProviderConfig(params.provider, params.requestOrigin);
  if (!config) {
    await createOAuthFailureAudit("user.oauth_failed", {
      provider: params.provider,
      reason: "provider_not_configured",
    });
    throw new Error(providerSetupMessage(params.provider));
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
      flow: savedState.flow,
    });
  } catch (error) {
    await createOAuthFailureAudit("user.oauth_failed", {
      provider: params.provider,
      reason: error instanceof Error ? error.message : "oauth_processing_failed",
      providerErrorCode: error instanceof OAuthProviderExchangeError ? error.providerErrorCode : undefined,
      providerErrorDescription: error instanceof OAuthProviderExchangeError ? error.providerErrorDescription : undefined,
      callbackUrlHost: new URL(config.callbackUrl).host,
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
    return onboardingDestinationWithPlan(config.defaultOrganizationType, savedState.selectedPlanSlug);
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
  selectedPlanSlug?: string | null;
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
    } else if (organizationType === OrganizationType.chef_business) {
      await tx.chefProfile.create({
        data: {
          organizationId: createdOrganization.id,
          countryCode: country.countryCode,
          displayName: organizationName,
          slug: `${slugify(organizationName)}-${Math.random().toString(36).slice(2, 8)}`,
          bio: "New chef profile. Add your specialties, service area, and verification details before going public.",
          languages: [],
          specialties: [],
          email: updatedUser.email,
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

  return getCheckoutDestinationForPlan({
    selectedPlanSlug: params.selectedPlanSlug,
    organizationId: organization.id,
    userId: user.id,
    fallbackDestination: POST_REGISTER_DESTINATION[params.accountType] ?? "/dashboard",
  });
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

export function getOAuthUserFacingErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  if (
    /can't reach database|database server|prisma|p1001|invocation/i.test(message)
  ) {
    return "Database unavailable. Please start PostgreSQL, then try social sign-in again.";
  }

  if (/user account is not active/i.test(message)) {
    return "This account is not active yet. Ask the Platform Owner to reactivate it, or sign up with a different email address.";
  }

  if (error instanceof OAuthProviderExchangeError) {
    if (/redirect_uri|redirect uri|redirect/i.test(error.providerErrorDescription ?? error.providerErrorCode ?? "")) {
      return `${providerDisplayName(error.provider)} rejected the callback URL. In Google/Facebook developer settings, add the exact production callback URL shown in Admin > API Management, then try again.`;
    }

    if (/client|secret|unauthorized|invalid_client/i.test(error.providerErrorDescription ?? error.providerErrorCode ?? "")) {
      return `${providerDisplayName(error.provider)} rejected the saved OAuth credentials. Please re-save the client ID and client secret in Admin > API Management.`;
    }

    return error.message;
  }

  return message;
}
