-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IntegrationProvider" AS ENUM (
    'google_maps',
    'google_places',
    'google_geocoding',
    'google_oauth',
    'facebook_oauth',
    'google_analytics',
    'google_search_console',
    'google_recaptcha',
    'google_adsense',
    'youtube_data',
    'aws_s3',
    's3_compatible',
    'smtp',
    'stripe',
    'paypal',
    'google_pay',
    'stripe_identity',
    'stripe_connect',
    'persona_placeholder',
    'checkr_placeholder',
    'kyc_provider',
    'background_check_provider',
    'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IntegrationCategory" AS ENUM (
    'maps',
    'auth',
    'analytics',
    'seo',
    'ads',
    'storage',
    'payments',
    'email',
    'verification',
    'security',
    'marketplace',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM ('draft', 'active', 'disabled', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IntegrationEnvironment" AS ENUM ('sandbox', 'production', 'development');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IntegrationTestStatus" AS ENUM ('not_tested', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformIntegration" (
  "id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "category" "IntegrationCategory" NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'draft',
  "environment" "IntegrationEnvironment" NOT NULL DEFAULT 'production',
  "countryCode" TEXT,
  "region" TEXT,
  "isGlobal" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "lastTestedAt" TIMESTAMP(3),
  "lastTestStatus" "IntegrationTestStatus" NOT NULL DEFAULT 'not_tested',
  "lastTestMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformIntegrationCredential" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "keyName" TEXT NOT NULL,
  "encryptedValue" TEXT NOT NULL,
  "valuePreview" TEXT NOT NULL,
  "isPublicClientValue" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "rotatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformIntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformIntegrationSetting" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "settingKey" TEXT NOT NULL,
  "settingValueJson" JSONB NOT NULL,
  "isSecret" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformIntegrationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformIntegrationTestLog" (
  "id" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "testType" TEXT NOT NULL,
  "status" "IntegrationTestStatus" NOT NULL DEFAULT 'not_tested',
  "message" TEXT NOT NULL,
  "metadataJson" JSONB,
  "testedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformIntegrationTestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformIntegration_provider_idx" ON "PlatformIntegration"("provider");
CREATE INDEX IF NOT EXISTS "PlatformIntegration_category_idx" ON "PlatformIntegration"("category");
CREATE INDEX IF NOT EXISTS "PlatformIntegration_status_idx" ON "PlatformIntegration"("status");
CREATE INDEX IF NOT EXISTS "PlatformIntegration_environment_idx" ON "PlatformIntegration"("environment");
CREATE INDEX IF NOT EXISTS "PlatformIntegration_countryCode_idx" ON "PlatformIntegration"("countryCode");
CREATE INDEX IF NOT EXISTS "PlatformIntegration_isDefault_idx" ON "PlatformIntegration"("isDefault");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformIntegrationCredential_integrationId_keyName_key" ON "PlatformIntegrationCredential"("integrationId", "keyName");
CREATE INDEX IF NOT EXISTS "PlatformIntegrationCredential_integrationId_idx" ON "PlatformIntegrationCredential"("integrationId");
CREATE INDEX IF NOT EXISTS "PlatformIntegrationCredential_keyName_idx" ON "PlatformIntegrationCredential"("keyName");
CREATE INDEX IF NOT EXISTS "PlatformIntegrationCredential_isPublicClientValue_idx" ON "PlatformIntegrationCredential"("isPublicClientValue");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformIntegrationSetting_integrationId_settingKey_key" ON "PlatformIntegrationSetting"("integrationId", "settingKey");
CREATE INDEX IF NOT EXISTS "PlatformIntegrationSetting_integrationId_idx" ON "PlatformIntegrationSetting"("integrationId");
CREATE INDEX IF NOT EXISTS "PlatformIntegrationSetting_isSecret_idx" ON "PlatformIntegrationSetting"("isSecret");
CREATE INDEX IF NOT EXISTS "PlatformIntegrationTestLog_integrationId_idx" ON "PlatformIntegrationTestLog"("integrationId");
CREATE INDEX IF NOT EXISTS "PlatformIntegrationTestLog_status_idx" ON "PlatformIntegrationTestLog"("status");
CREATE INDEX IF NOT EXISTS "PlatformIntegrationTestLog_testedById_idx" ON "PlatformIntegrationTestLog"("testedById");
CREATE INDEX IF NOT EXISTS "PlatformIntegrationTestLog_createdAt_idx" ON "PlatformIntegrationTestLog"("createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PlatformIntegration"
  ADD CONSTRAINT "PlatformIntegration_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformIntegration"
  ADD CONSTRAINT "PlatformIntegration_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformIntegrationCredential"
  ADD CONSTRAINT "PlatformIntegrationCredential_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "PlatformIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformIntegrationCredential"
  ADD CONSTRAINT "PlatformIntegrationCredential_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformIntegrationCredential"
  ADD CONSTRAINT "PlatformIntegrationCredential_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformIntegrationSetting"
  ADD CONSTRAINT "PlatformIntegrationSetting_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "PlatformIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformIntegrationTestLog"
  ADD CONSTRAINT "PlatformIntegrationTestLog_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "PlatformIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformIntegrationTestLog"
  ADD CONSTRAINT "PlatformIntegrationTestLog_testedById_fkey"
  FOREIGN KEY ("testedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
