import { KycProvider, KycProviderStatus, type KycProviderConfiguration, type PlatformRole, type Prisma, type UserStatus } from "@prisma/client";
import { assertCountryAccess, assertPlatformRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backgroundCheckConsentSchema, backgroundCheckRequestSchema, backgroundCheckStatusSchema, identityVerificationStartSchema, kycProviderConfigurationSchema } from "@/lib/validation/kyc";
import { createAuditEvent } from "@/server/audit";
import { createConsentEvent } from "@/server/legal/legal-service";
import { encryptGatewayCredential, isPaymentEncryptionConfigured, maskCredentialPreview, decryptGatewayCredential } from "@/server/payments/credentials";
import { getOrCreateSellerVerificationProfile } from "@/server/seller-verifications";
import { CheckrPlaceholderBackgroundProvider, CheckrPlaceholderKycProvider } from "@/server/kyc/providers/checkr-placeholder-provider";
import { PersonaPlaceholderProvider } from "@/server/kyc/providers/persona-placeholder-provider";
import { StripeConnectProvider } from "@/server/kyc/providers/stripe-connect-provider";
import { StripeIdentityProvider } from "@/server/kyc/providers/stripe-identity-provider";
import type { KycProviderAdapter, KycProviderConfig, KycWebhookInput } from "@/server/kyc/kyc-provider";

type AdminSession = { user: { id: string; status: UserStatus; platformRole: PlatformRole | null }; countryAssignments?: Array<{ countryCode: string }> };
type SellerSession = AdminSession & { activeOrganization?: { id: string; countryCode: string; organizationType: string; name?: string } | null; activeMembership?: { role: string; status: string } | null };

const VIEW_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager", "support_admin", "auditor"];
const MANAGE_ROLES: PlatformRole[] = ["platform_owner", "platform_admin", "country_manager"];
const SECRET_ROLES: PlatformRole[] = ["platform_owner", "platform_admin"];

export function kycOperationalStatus() {
  return { encryptionConfigured: isPaymentEncryptionConfigured(), rawIdentityDataStored: false, rawBackgroundReportsStored: false };
}

export async function listKycProviderConfigurations(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, VIEW_ROLES);
  const where = countryWhere(session);
  const configs = await prisma.kycProviderConfiguration.findMany({ where, orderBy: [{ provider: "asc" }, { createdAt: "desc" }] });
  return configs.map(redactProviderConfiguration);
}

export async function saveKycProviderConfiguration(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, SECRET_ROLES);
  if (!isPaymentEncryptionConfigured()) throw new Error("ENCRYPTION_KEY is required before saving KYC provider secrets.");
  const parsed = kycProviderConfigurationSchema.parse(input);
  if (session.user.platformRole === "country_manager" && parsed.countryCode) assertCountryAccess(session as never, parsed.countryCode);
  const data = {
    provider: parsed.provider,
    displayName: parsed.displayName,
    status: parsed.status,
    environment: parsed.environment,
    countryCode: parsed.countryCode?.toUpperCase() ?? null,
    supportedCountriesJson: parsed.supportedCountries.map((country) => country.toUpperCase()),
    settingsJson: parsed.settingsJson === undefined ? undefined : parsed.settingsJson as Prisma.InputJsonValue,
    ...(parsed.apiKey ? { encryptedApiKey: encryptGatewayCredential(parsed.apiKey) } : {}),
    ...(parsed.secret ? { encryptedSecret: encryptGatewayCredential(parsed.secret) } : {}),
    ...(parsed.webhookSecret ? { encryptedWebhookSecret: encryptGatewayCredential(parsed.webhookSecret) } : {}),
    updatedById: session.user.id,
  };
  const config = parsed.id
    ? await prisma.kycProviderConfiguration.update({ where: { id: parsed.id }, data })
    : await prisma.kycProviderConfiguration.create({ data: { ...data, createdById: session.user.id } });
  await createAuditEvent({ actorUserId: session.user.id, countryCode: config.countryCode, action: parsed.id ? "kyc_provider.updated" : "kyc_provider.created", targetType: "kyc_provider_configuration", targetId: config.id, details: { provider: config.provider, status: config.status } });
  return redactProviderConfiguration(config);
}

export async function startIdentityVerification(session: SellerSession, input: unknown) {
  const parsed = identityVerificationStartSchema.parse(input);
  const profile = await getOrCreateSellerVerificationProfile(session);
  const config = await findActiveProviderConfig(parsed.provider ?? "stripe_identity", profile.countryCode);
  if (!config) throw new Error("Identity verification provider is not configured.");
  const adapter = adapterForConfig(config);
  const result = await adapter.createVerificationSession({ organizationId: profile.organizationId, verificationProfileId: profile.id, userId: session.user.id, returnUrl: parsed.returnUrl });
  const identity = await prisma.identityVerification.create({
    data: {
      organizationId: profile.organizationId,
      verificationProfileId: profile.id,
      userId: session.user.id,
      provider: result.provider,
      providerSessionId: result.providerSessionId ?? null,
      providerStatus: result.providerStatus ?? null,
      status: result.status,
      verificationUrl: result.verificationUrl ?? null,
      expiresAt: result.expiresAt ?? null,
      metadataJson: (result.metadata ?? {}) as Prisma.InputJsonObject,
    },
  });
  await prisma.sellerVerificationItem.upsert({
    where: { id: `identity-${identity.id}` },
    update: {},
    create: { verificationProfileId: profile.id, requirementType: "identity", status: "provider_pending", provider: providerToVerificationProvider(result.provider), providerReferenceId: result.providerSessionId ?? null, providerStatus: result.providerStatus ?? null, submittedAt: new Date() },
  }).catch(async () => {
    await prisma.sellerVerificationItem.create({ data: { verificationProfileId: profile.id, requirementType: "identity", status: "provider_pending", provider: providerToVerificationProvider(result.provider), providerReferenceId: result.providerSessionId ?? null, providerStatus: result.providerStatus ?? null, submittedAt: new Date() } });
  });
  await createAuditEvent({ actorUserId: session.user.id, organizationId: profile.organizationId, countryCode: profile.countryCode, action: "identity_verification.session_created", targetType: "identity_verification", targetId: identity.id, details: { provider: identity.provider } });
  return identity;
}

export async function collectBackgroundCheckConsent(session: SellerSession, input: unknown, requestMeta?: { ipAddress?: string | null; userAgent?: string | null }) {
  const parsed = backgroundCheckConsentSchema.parse(input);
  const profile = await getOrCreateSellerVerificationProfile(session);
  const attestation = await prisma.sellerAttestation.create({
    data: { organizationId: profile.organizationId, verificationProfileId: profile.id, attestationType: "background_check_consent", version: parsed.version, textSnapshot: parsed.textSnapshot, acceptedByUserId: session.user.id, ipAddress: requestMeta?.ipAddress ?? null, userAgent: requestMeta?.userAgent ?? null },
  });
  await createConsentEvent({
    userId: session.user.id,
    organizationId: profile.organizationId,
    consentType: "background_check_consent",
    status: "accepted",
    version: parsed.version,
    textSnapshot: parsed.textSnapshot,
    ipAddress: requestMeta?.ipAddress ?? null,
    userAgent: requestMeta?.userAgent ?? null,
  });
  const check = await prisma.sellerBackgroundCheck.create({
    data: { organizationId: profile.organizationId, verificationProfileId: profile.id, provider: "checkr_placeholder", status: "consent_collected", consentAttestationId: attestation.id },
  });
  await createAuditEvent({ actorUserId: session.user.id, organizationId: profile.organizationId, countryCode: profile.countryCode, action: "background_check.consent_collected", targetType: "seller_background_check", targetId: check.id });
  return check;
}

export async function requestBackgroundCheck(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);
  const parsed = backgroundCheckRequestSchema.parse(input);
  const profile = await prisma.sellerVerificationProfile.findUnique({ where: { id: parsed.verificationProfileId }, include: { backgroundChecks: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!profile) throw new Error("Verification profile not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session as never, profile.countryCode);
  const latest = profile.backgroundChecks[0];
  if (!latest?.consentAttestationId) throw new Error("Background checks require consent before they are ordered.");
  const provider = new CheckrPlaceholderBackgroundProvider();
  const result = await provider.orderReport({ organizationId: profile.organizationId, verificationProfileId: profile.id, consentAttestationId: latest.consentAttestationId });
  const check = await prisma.sellerBackgroundCheck.update({ where: { id: latest.id }, data: { status: result.status, provider: result.provider, providerCandidateId: result.providerCandidateId ?? null, providerReportId: result.providerReportId ?? null, requestedById: session.user.id, requestedAt: new Date() } });
  await createAuditEvent({ actorUserId: session.user.id, organizationId: profile.organizationId, countryCode: profile.countryCode, action: "background_check.requested", targetType: "seller_background_check", targetId: check.id });
  return check;
}

export async function updateBackgroundCheckStatus(session: AdminSession, input: unknown) {
  assertPlatformRole(session.user.platformRole, MANAGE_ROLES);
  const parsed = backgroundCheckStatusSchema.parse(input);
  const existing = await prisma.sellerBackgroundCheck.findUnique({ where: { id: parsed.backgroundCheckId }, include: { verificationProfile: true } });
  if (!existing) throw new Error("Background check not found.");
  if (session.user.platformRole === "country_manager") assertCountryAccess(session as never, existing.verificationProfile.countryCode);
  const check = await prisma.sellerBackgroundCheck.update({ where: { id: existing.id }, data: { status: parsed.status, resultSummary: parsed.resultSummary ?? null, completedAt: ["clear", "consider", "failed", "cancelled"].includes(parsed.status) ? new Date() : null } });
  await createAuditEvent({ actorUserId: session.user.id, organizationId: existing.organizationId, countryCode: existing.verificationProfile.countryCode, action: "background_check.status_updated", targetType: "seller_background_check", targetId: check.id, details: { status: check.status } });
  return check;
}

export async function recordKycWebhook(provider: KycProvider, input: KycWebhookInput) {
  const config = await findActiveProviderConfig(provider, null);
  const adapter = adapterForConfig(config, provider);
  const result = await adapter.handleWebhook(input);
  const existing = await prisma.kycWebhookEvent.findUnique({ where: { provider_eventId: { provider, eventId: result.eventId } } });
  if (existing?.status === "processed") return existing;
  const event = await prisma.kycWebhookEvent.upsert({
    where: { provider_eventId: { provider, eventId: result.eventId } },
    update: { signatureValid: result.signatureValid, status: result.status, processedAt: result.status === "processed" ? new Date() : null, errorMessage: result.message ?? null },
    create: { provider, eventId: result.eventId, eventType: result.eventType, signatureValid: result.signatureValid, status: result.status, rawJson: safeJson(input.rawBody), processedAt: result.status === "processed" ? new Date() : null, errorMessage: result.message ?? null },
  });
  if (result.providerSessionId && result.identityStatus) {
    await prisma.identityVerification.updateMany({ where: { provider, providerSessionId: result.providerSessionId }, data: { status: result.identityStatus, providerStatus: result.providerStatus ?? null, completedAt: result.identityStatus === "verified" ? new Date() : null } });
  }
  await createAuditEvent({ action: result.status === "processed" ? "kyc_webhook.processed" : "kyc_webhook.failed", targetType: "kyc_webhook_event", targetId: event.id, details: { provider, eventType: event.eventType } });
  return event;
}

export async function listIdentityVerifications(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, VIEW_ROLES);
  return prisma.identityVerification.findMany({ where: { organization: countryWhere(session) }, include: { organization: { select: { name: true, countryCode: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
}

export async function listKycWebhookEvents(session: AdminSession) {
  assertPlatformRole(session.user.platformRole, VIEW_ROLES);
  return prisma.kycWebhookEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

function countryWhere(session: AdminSession) {
  if (session.user.platformRole === "country_manager") return { countryCode: { in: session.countryAssignments?.map((assignment) => assignment.countryCode) ?? [] } };
  return {};
}

export type RedactedKycProviderConfiguration = Omit<KycProviderConfiguration, "encryptedApiKey" | "encryptedSecret" | "encryptedWebhookSecret"> & {
  apiKeyPreview: string | null;
  secretConfigured: boolean;
  webhookSecretConfigured: boolean;
};

function redactProviderConfiguration(config: KycProviderConfiguration): RedactedKycProviderConfiguration {
  return {
    id: config.id,
    provider: config.provider,
    displayName: config.displayName,
    status: config.status,
    environment: config.environment,
    countryCode: config.countryCode,
    supportedCountriesJson: config.supportedCountriesJson,
    settingsJson: config.settingsJson,
    createdById: config.createdById,
    updatedById: config.updatedById,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    apiKeyPreview: preview(config.encryptedApiKey),
    secretConfigured: Boolean(config.encryptedSecret),
    webhookSecretConfigured: Boolean(config.encryptedWebhookSecret),
  };
}

function preview(encrypted?: string | null) {
  if (!encrypted) return null;
  try {
    return maskCredentialPreview(decryptGatewayCredential(encrypted));
  } catch {
    return "configured";
  }
}

async function findActiveProviderConfig(provider: KycProvider, countryCode: string | null) {
  const config = await prisma.kycProviderConfiguration.findFirst({
    where: {
      provider,
      status: KycProviderStatus.active,
      OR: countryCode ? [{ countryCode }, { countryCode: null }] : [{ countryCode: null }],
    },
    orderBy: [{ countryCode: "desc" }, { createdAt: "desc" }],
  });
  if (!config) return null;
  return {
    id: config.id,
    provider: config.provider,
    environment: config.environment,
    apiKey: config.encryptedApiKey ? decryptGatewayCredential(config.encryptedApiKey) : null,
    secret: config.encryptedSecret ? decryptGatewayCredential(config.encryptedSecret) : null,
    webhookSecret: config.encryptedWebhookSecret ? decryptGatewayCredential(config.encryptedWebhookSecret) : null,
    settings: config.settingsJson,
  } satisfies KycProviderConfig;
}

function adapterForConfig(config: KycProviderConfig | null, fallbackProvider?: KycProvider): KycProviderAdapter {
  const provider = config?.provider ?? fallbackProvider ?? KycProvider.manual;
  if (provider === "stripe_identity") return new StripeIdentityProvider(config);
  if (provider === "stripe_connect") return new StripeConnectProvider(config);
  if (provider === "persona_placeholder") return new PersonaPlaceholderProvider(config);
  if (provider === "checkr_placeholder") return new CheckrPlaceholderKycProvider();
  return new PersonaPlaceholderProvider(config);
}

function providerToVerificationProvider(provider: KycProvider) {
  if (provider === "stripe_identity") return "stripe_identity";
  if (provider === "stripe_connect") return "stripe_connect";
  if (provider === "persona_placeholder") return "persona_placeholder";
  if (provider === "checkr_placeholder") return "checkr_placeholder";
  return "manual";
}

function safeJson(rawBody: string) {
  try {
    return JSON.parse(rawBody) as Prisma.InputJsonValue;
  } catch {
    return { raw: rawBody.slice(0, 5000) };
  }
}
