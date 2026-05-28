-- AlterEnum
ALTER TYPE "LegalDocumentType" ADD VALUE IF NOT EXISTS 'user_terms';
ALTER TYPE "LegalDocumentType" ADD VALUE IF NOT EXISTS 'seller_terms';

-- CreateEnum
CREATE TYPE "UserActivityVisibility" AS ENUM ('private', 'organization', 'admin_only');

-- CreateEnum
CREATE TYPE "UserActivityType" AS ENUM ('login', 'logout', 'recipe_viewed', 'recipe_favorited', 'meal_plan_created', 'grocery_list_created', 'order_created', 'support_ticket_created', 'profile_updated', 'file_uploaded', 'privacy_action', 'other');

-- CreateEnum
CREATE TYPE "UserProfileVisibility" AS ENUM ('private', 'organization', 'public');

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "activityType" "UserActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadataJson" JSONB,
    "visibility" "UserActivityVisibility" NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPrivacySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileVisibility" "UserProfileVisibility" NOT NULL DEFAULT 'private',
    "activityRetentionDays" INTEGER,
    "marketingEmailsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "analyticsConsent" BOOLEAN NOT NULL DEFAULT false,
    "personalizedRecommendationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPrivacySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserActivity_userId_idx" ON "UserActivity"("userId");
CREATE INDEX "UserActivity_organizationId_idx" ON "UserActivity"("organizationId");
CREATE INDEX "UserActivity_activityType_idx" ON "UserActivity"("activityType");
CREATE INDEX "UserActivity_visibility_idx" ON "UserActivity"("visibility");
CREATE INDEX "UserActivity_createdAt_idx" ON "UserActivity"("createdAt");
CREATE INDEX "UserActivity_deletedAt_idx" ON "UserActivity"("deletedAt");
CREATE UNIQUE INDEX "UserPrivacySetting_userId_key" ON "UserPrivacySetting"("userId");
CREATE INDEX "UserPrivacySetting_profileVisibility_idx" ON "UserPrivacySetting"("profileVisibility");
CREATE INDEX "UserPrivacySetting_analyticsConsent_idx" ON "UserPrivacySetting"("analyticsConsent");
CREATE INDEX "UserPrivacySetting_marketingEmailsEnabled_idx" ON "UserPrivacySetting"("marketingEmailsEnabled");

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserPrivacySetting" ADD CONSTRAINT "UserPrivacySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
