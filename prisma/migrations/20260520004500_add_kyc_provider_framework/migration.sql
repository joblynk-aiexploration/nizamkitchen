CREATE TYPE "KycProvider" AS ENUM ('stripe_identity', 'stripe_connect', 'persona_placeholder', 'checkr_placeholder', 'manual');
CREATE TYPE "KycProviderStatus" AS ENUM ('draft', 'active', 'disabled', 'error');
CREATE TYPE "IdentityVerificationStatus" AS ENUM ('not_started', 'session_created', 'pending', 'verified', 'failed', 'expired', 'cancelled');

CREATE TABLE "KycProviderConfiguration" (
  "id" TEXT NOT NULL,
  "provider" "KycProvider" NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "KycProviderStatus" NOT NULL DEFAULT 'draft',
  "environment" "PaymentEnvironment" NOT NULL DEFAULT 'sandbox',
  "countryCode" TEXT,
  "supportedCountriesJson" JSONB NOT NULL,
  "encryptedApiKey" TEXT,
  "encryptedSecret" TEXT,
  "encryptedWebhookSecret" TEXT,
  "settingsJson" JSONB,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KycProviderConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdentityVerification" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "verificationProfileId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "KycProvider" NOT NULL,
  "providerSessionId" TEXT,
  "providerStatus" TEXT,
  "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'not_started',
  "verificationUrl" TEXT,
  "expiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdentityVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" "KycProvider" NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "status" "PaymentWebhookStatus" NOT NULL DEFAULT 'received',
  "rawJson" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KycProviderConfiguration_provider_idx" ON "KycProviderConfiguration"("provider");
CREATE INDEX "KycProviderConfiguration_status_idx" ON "KycProviderConfiguration"("status");
CREATE INDEX "KycProviderConfiguration_environment_idx" ON "KycProviderConfiguration"("environment");
CREATE INDEX "KycProviderConfiguration_countryCode_idx" ON "KycProviderConfiguration"("countryCode");

CREATE INDEX "IdentityVerification_organizationId_idx" ON "IdentityVerification"("organizationId");
CREATE INDEX "IdentityVerification_verificationProfileId_idx" ON "IdentityVerification"("verificationProfileId");
CREATE INDEX "IdentityVerification_userId_idx" ON "IdentityVerification"("userId");
CREATE INDEX "IdentityVerification_provider_idx" ON "IdentityVerification"("provider");
CREATE INDEX "IdentityVerification_providerSessionId_idx" ON "IdentityVerification"("providerSessionId");
CREATE INDEX "IdentityVerification_status_idx" ON "IdentityVerification"("status");

CREATE UNIQUE INDEX "KycWebhookEvent_provider_eventId_key" ON "KycWebhookEvent"("provider", "eventId");
CREATE INDEX "KycWebhookEvent_provider_idx" ON "KycWebhookEvent"("provider");
CREATE INDEX "KycWebhookEvent_eventType_idx" ON "KycWebhookEvent"("eventType");
CREATE INDEX "KycWebhookEvent_status_idx" ON "KycWebhookEvent"("status");
CREATE INDEX "KycWebhookEvent_createdAt_idx" ON "KycWebhookEvent"("createdAt");

ALTER TABLE "KycProviderConfiguration" ADD CONSTRAINT "KycProviderConfiguration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KycProviderConfiguration" ADD CONSTRAINT "KycProviderConfiguration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_verificationProfileId_fkey" FOREIGN KEY ("verificationProfileId") REFERENCES "SellerVerificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IdentityVerification" ADD CONSTRAINT "IdentityVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
