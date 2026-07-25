-- Extend platform integration registry for Secure Privacy CMP.
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'secure_privacy';
ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'consent';
ALTER TYPE "LegalDocumentType" ADD VALUE IF NOT EXISTS 'cookie_policy';

-- Store user cookie preferences separately from email marketing preferences.
ALTER TABLE "UserPrivacySetting"
  ADD COLUMN IF NOT EXISTS "marketingCookiesConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "functionalCookiesConsent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cookiePreferencesUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "UserPrivacySetting_marketingCookiesConsent_idx"
  ON "UserPrivacySetting"("marketingCookiesConsent");
