-- Enterprise email templates, preferences, suppressions, and delivery logs.
CREATE TYPE "EmailTemplateCategory" AS ENUM (
  'authentication',
  'account',
  'legal_privacy',
  'household',
  'meal_planning',
  'grocery',
  'home_chef',
  'chef_staff',
  'home_catering',
  'restaurant',
  'food_order',
  'payment',
  'billing',
  'invoice',
  'refund',
  'payout',
  'verification',
  'storage',
  'support',
  'notification',
  'review',
  'promotion',
  'referral',
  'admin_alert',
  'system'
);

CREATE TYPE "EmailTemplateStatus" AS ENUM ('draft', 'active', 'archived');
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('queued', 'sent', 'failed', 'skipped', 'suppressed');
CREATE TYPE "EmailProvider" AS ENUM ('disabled', 'smtp', 'sendgrid_placeholder', 'resend_placeholder', 'postmark_placeholder', 'ses_placeholder');
CREATE TYPE "EmailSuppressionReason" AS ENUM ('unsubscribed', 'bounced', 'complaint', 'admin_suppressed', 'invalid_email');

CREATE TABLE "EmailTemplate" (
  "id" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "EmailTemplateCategory" NOT NULL,
  "subject" TEXT NOT NULL,
  "preheader" TEXT,
  "htmlBody" TEXT NOT NULL,
  "textBody" TEXT NOT NULL,
  "status" "EmailTemplateStatus" NOT NULL DEFAULT 'draft',
  "locale" TEXT,
  "countryCode" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailTemplateVariable" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "variableKey" TEXT NOT NULL,
  "description" TEXT,
  "exampleValue" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailTemplateVariable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "transactionalEnabled" BOOLEAN NOT NULL DEFAULT true,
  "marketingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "mealPlanningEmails" BOOLEAN NOT NULL DEFAULT true,
  "groceryEmails" BOOLEAN NOT NULL DEFAULT true,
  "orderEmails" BOOLEAN NOT NULL DEFAULT true,
  "homeChefEmails" BOOLEAN NOT NULL DEFAULT true,
  "sellerEmails" BOOLEAN NOT NULL DEFAULT true,
  "paymentEmails" BOOLEAN NOT NULL DEFAULT true,
  "verificationEmails" BOOLEAN NOT NULL DEFAULT true,
  "supportEmails" BOOLEAN NOT NULL DEFAULT true,
  "reviewEmails" BOOLEAN NOT NULL DEFAULT true,
  "promotionEmails" BOOLEAN NOT NULL DEFAULT false,
  "adminAlertEmails" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSuppression" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "reason" "EmailSuppressionReason" NOT NULL,
  "category" "EmailTemplateCategory",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmailLog" ALTER COLUMN "templateKey" DROP NOT NULL;
ALTER TABLE "EmailLog" ALTER COLUMN "deliveryStatus" SET DEFAULT 'queued';
ALTER TABLE "EmailLog" ADD COLUMN "recipientUserId" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "category" "EmailTemplateCategory" NOT NULL DEFAULT 'notification';
ALTER TABLE "EmailLog" ADD COLUMN "subject" TEXT NOT NULL DEFAULT 'NizamKitchen update';
ALTER TABLE "EmailLog" ADD COLUMN "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'queued';
ALTER TABLE "EmailLog" ADD COLUMN "provider" "EmailProvider" NOT NULL DEFAULT 'disabled';
ALTER TABLE "EmailLog" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "metadataJson" JSONB;
ALTER TABLE "EmailLog" ADD COLUMN "sentAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "EmailTemplate_templateKey_locale_countryCode_version_key" ON "EmailTemplate"("templateKey", "locale", "countryCode", "version");
CREATE INDEX "EmailTemplate_templateKey_idx" ON "EmailTemplate"("templateKey");
CREATE INDEX "EmailTemplate_category_idx" ON "EmailTemplate"("category");
CREATE INDEX "EmailTemplate_status_idx" ON "EmailTemplate"("status");
CREATE INDEX "EmailTemplate_locale_idx" ON "EmailTemplate"("locale");
CREATE INDEX "EmailTemplate_countryCode_idx" ON "EmailTemplate"("countryCode");
CREATE INDEX "EmailTemplate_isSystem_idx" ON "EmailTemplate"("isSystem");

CREATE UNIQUE INDEX "EmailTemplateVariable_templateId_variableKey_key" ON "EmailTemplateVariable"("templateId", "variableKey");
CREATE INDEX "EmailTemplateVariable_templateId_idx" ON "EmailTemplateVariable"("templateId");

CREATE UNIQUE INDEX "EmailPreference_userId_key" ON "EmailPreference"("userId");

CREATE UNIQUE INDEX "EmailSuppression_email_category_key" ON "EmailSuppression"("email", "category");
CREATE INDEX "EmailSuppression_email_idx" ON "EmailSuppression"("email");
CREATE INDEX "EmailSuppression_reason_idx" ON "EmailSuppression"("reason");
CREATE INDEX "EmailSuppression_category_idx" ON "EmailSuppression"("category");

CREATE INDEX "EmailLog_recipientUserId_idx" ON "EmailLog"("recipientUserId");
CREATE INDEX "EmailLog_recipientEmail_idx" ON "EmailLog"("recipientEmail");
CREATE INDEX "EmailLog_templateKey_idx" ON "EmailLog"("templateKey");
CREATE INDEX "EmailLog_category_idx" ON "EmailLog"("category");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_provider_idx" ON "EmailLog"("provider");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailTemplateVariable" ADD CONSTRAINT "EmailTemplateVariable_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailPreference" ADD CONSTRAINT "EmailPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
