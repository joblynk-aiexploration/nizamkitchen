-- Extend storage purposes for seller compliance uploads.
ALTER TYPE "StorageFilePurpose" ADD VALUE IF NOT EXISTS 'business_license_document';
ALTER TYPE "StorageFilePurpose" ADD VALUE IF NOT EXISTS 'food_handler_certificate';
ALTER TYPE "StorageFilePurpose" ADD VALUE IF NOT EXISTS 'kitchen_photo';
ALTER TYPE "StorageFilePurpose" ADD VALUE IF NOT EXISTS 'background_check_consent';

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('chef_business', 'home_catering', 'restaurant');
CREATE TYPE "SellerVerificationStatus" AS ENUM ('not_started', 'in_progress', 'submitted', 'under_review', 'verified', 'rejected', 'expired', 'suspended');
CREATE TYPE "SellerVerificationLevel" AS ENUM ('unverified', 'profile_verified', 'identity_verified', 'food_safety_verified', 'kitchen_reviewed', 'background_checked', 'fully_verified');
CREATE TYPE "SellerRequirementType" AS ENUM ('identity', 'business_info', 'food_handler_certificate', 'local_permit', 'kitchen_photos', 'background_check', 'payout_onboarding', 'insurance', 'tax_form', 'platform_attestation', 'trial_taste_test', 'other');
CREATE TYPE "SellerVerificationItemStatus" AS ENUM ('not_started', 'pending', 'submitted', 'approved', 'rejected', 'expired', 'provider_pending', 'provider_failed');
CREATE TYPE "VerificationProvider" AS ENUM ('manual', 'stripe_identity', 'stripe_connect', 'persona_placeholder', 'checkr_placeholder', 'local_admin_review', 'other');
CREATE TYPE "BackgroundCheckStatus" AS ENUM ('not_started', 'consent_required', 'consent_collected', 'requested', 'pending', 'clear', 'consider', 'suspended', 'failed', 'cancelled');
CREATE TYPE "AdverseActionStatus" AS ENUM ('none', 'pre_adverse_action', 'waiting_period', 'post_adverse_action', 'resolved');
CREATE TYPE "KitchenSafetyReviewStatus" AS ENUM ('not_started', 'submitted', 'under_review', 'approved', 'rejected', 'needs_more_info');
CREATE TYPE "KitchenSafetyPhotoCategory" AS ENUM ('cooking_area', 'sink_sanitation', 'refrigerator_storage', 'dry_storage', 'prep_surface', 'packaging_area', 'handwashing', 'other');
CREATE TYPE "AttestationType" AS ENUM ('food_safety_responsibility', 'cottage_food_compliance', 'background_check_consent', 'seller_terms', 'tax_responsibility', 'kitchen_safety_attestation', 'local_law_acknowledgement');

-- CreateTable
CREATE TABLE "SellerVerificationProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "region" TEXT,
    "sellerType" "SellerType" NOT NULL,
    "status" "SellerVerificationStatus" NOT NULL DEFAULT 'not_started',
    "verificationLevel" "SellerVerificationLevel" NOT NULL DEFAULT 'unverified',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerVerificationProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerVerificationRequirement" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT,
    "region" TEXT,
    "sellerType" "SellerType" NOT NULL,
    "requirementType" "SellerRequirementType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "provider" "VerificationProvider" NOT NULL DEFAULT 'manual',
    "validityDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerVerificationRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerVerificationItem" (
    "id" TEXT NOT NULL,
    "verificationProfileId" TEXT NOT NULL,
    "requirementId" TEXT,
    "requirementType" "SellerRequirementType" NOT NULL,
    "status" "SellerVerificationItemStatus" NOT NULL DEFAULT 'not_started',
    "documentFileId" TEXT,
    "provider" "VerificationProvider" NOT NULL DEFAULT 'manual',
    "providerReferenceId" TEXT,
    "providerStatus" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerVerificationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerAttestation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "verificationProfileId" TEXT NOT NULL,
    "attestationType" "AttestationType" NOT NULL,
    "version" TEXT NOT NULL,
    "textSnapshot" TEXT NOT NULL,
    "acceptedByUserId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerAttestation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerBackgroundCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "verificationProfileId" TEXT NOT NULL,
    "provider" "VerificationProvider" NOT NULL DEFAULT 'checkr_placeholder',
    "providerCandidateId" TEXT,
    "providerReportId" TEXT,
    "status" "BackgroundCheckStatus" NOT NULL DEFAULT 'not_started',
    "consentAttestationId" TEXT,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resultSummary" TEXT,
    "adverseActionStatus" "AdverseActionStatus" NOT NULL DEFAULT 'none',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerBackgroundCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenSafetyReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "verificationProfileId" TEXT NOT NULL,
    "status" "KitchenSafetyReviewStatus" NOT NULL DEFAULT 'not_started',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "cleanlinessScore" INTEGER,
    "storageScore" INTEGER,
    "sanitationScore" INTEGER,
    "packagingScore" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KitchenSafetyReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenSafetyPhoto" (
    "id" TEXT NOT NULL,
    "kitchenSafetyReviewId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "category" "KitchenSafetyPhotoCategory" NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KitchenSafetyPhoto_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "SellerVerificationProfile_organizationId_key" ON "SellerVerificationProfile"("organizationId");
CREATE INDEX "SellerVerificationProfile_organizationId_idx" ON "SellerVerificationProfile"("organizationId");
CREATE INDEX "SellerVerificationProfile_countryCode_idx" ON "SellerVerificationProfile"("countryCode");
CREATE INDEX "SellerVerificationProfile_region_idx" ON "SellerVerificationProfile"("region");
CREATE INDEX "SellerVerificationProfile_sellerType_idx" ON "SellerVerificationProfile"("sellerType");
CREATE INDEX "SellerVerificationProfile_status_idx" ON "SellerVerificationProfile"("status");
CREATE INDEX "SellerVerificationProfile_verificationLevel_idx" ON "SellerVerificationProfile"("verificationLevel");
CREATE INDEX "SellerVerificationRequirement_countryCode_idx" ON "SellerVerificationRequirement"("countryCode");
CREATE INDEX "SellerVerificationRequirement_region_idx" ON "SellerVerificationRequirement"("region");
CREATE INDEX "SellerVerificationRequirement_sellerType_idx" ON "SellerVerificationRequirement"("sellerType");
CREATE INDEX "SellerVerificationRequirement_requirementType_idx" ON "SellerVerificationRequirement"("requirementType");
CREATE INDEX "SellerVerificationRequirement_isActive_idx" ON "SellerVerificationRequirement"("isActive");
CREATE INDEX "SellerVerificationItem_verificationProfileId_idx" ON "SellerVerificationItem"("verificationProfileId");
CREATE INDEX "SellerVerificationItem_requirementId_idx" ON "SellerVerificationItem"("requirementId");
CREATE INDEX "SellerVerificationItem_requirementType_idx" ON "SellerVerificationItem"("requirementType");
CREATE INDEX "SellerVerificationItem_status_idx" ON "SellerVerificationItem"("status");
CREATE INDEX "SellerVerificationItem_documentFileId_idx" ON "SellerVerificationItem"("documentFileId");
CREATE INDEX "SellerAttestation_organizationId_idx" ON "SellerAttestation"("organizationId");
CREATE INDEX "SellerAttestation_verificationProfileId_idx" ON "SellerAttestation"("verificationProfileId");
CREATE INDEX "SellerAttestation_attestationType_idx" ON "SellerAttestation"("attestationType");
CREATE INDEX "SellerAttestation_acceptedByUserId_idx" ON "SellerAttestation"("acceptedByUserId");
CREATE INDEX "SellerBackgroundCheck_organizationId_idx" ON "SellerBackgroundCheck"("organizationId");
CREATE INDEX "SellerBackgroundCheck_verificationProfileId_idx" ON "SellerBackgroundCheck"("verificationProfileId");
CREATE INDEX "SellerBackgroundCheck_status_idx" ON "SellerBackgroundCheck"("status");
CREATE INDEX "SellerBackgroundCheck_provider_idx" ON "SellerBackgroundCheck"("provider");
CREATE INDEX "KitchenSafetyReview_organizationId_idx" ON "KitchenSafetyReview"("organizationId");
CREATE INDEX "KitchenSafetyReview_verificationProfileId_idx" ON "KitchenSafetyReview"("verificationProfileId");
CREATE INDEX "KitchenSafetyReview_status_idx" ON "KitchenSafetyReview"("status");
CREATE INDEX "KitchenSafetyPhoto_kitchenSafetyReviewId_idx" ON "KitchenSafetyPhoto"("kitchenSafetyReviewId");
CREATE INDEX "KitchenSafetyPhoto_fileId_idx" ON "KitchenSafetyPhoto"("fileId");
CREATE INDEX "KitchenSafetyPhoto_category_idx" ON "KitchenSafetyPhoto"("category");

-- Foreign keys
ALTER TABLE "SellerVerificationProfile" ADD CONSTRAINT "SellerVerificationProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerVerificationProfile" ADD CONSTRAINT "SellerVerificationProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerVerificationItem" ADD CONSTRAINT "SellerVerificationItem_verificationProfileId_fkey" FOREIGN KEY ("verificationProfileId") REFERENCES "SellerVerificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerVerificationItem" ADD CONSTRAINT "SellerVerificationItem_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "SellerVerificationRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerVerificationItem" ADD CONSTRAINT "SellerVerificationItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerAttestation" ADD CONSTRAINT "SellerAttestation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerAttestation" ADD CONSTRAINT "SellerAttestation_verificationProfileId_fkey" FOREIGN KEY ("verificationProfileId") REFERENCES "SellerVerificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerAttestation" ADD CONSTRAINT "SellerAttestation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerBackgroundCheck" ADD CONSTRAINT "SellerBackgroundCheck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerBackgroundCheck" ADD CONSTRAINT "SellerBackgroundCheck_verificationProfileId_fkey" FOREIGN KEY ("verificationProfileId") REFERENCES "SellerVerificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerBackgroundCheck" ADD CONSTRAINT "SellerBackgroundCheck_consentAttestationId_fkey" FOREIGN KEY ("consentAttestationId") REFERENCES "SellerAttestation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerBackgroundCheck" ADD CONSTRAINT "SellerBackgroundCheck_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KitchenSafetyReview" ADD CONSTRAINT "KitchenSafetyReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenSafetyReview" ADD CONSTRAINT "KitchenSafetyReview_verificationProfileId_fkey" FOREIGN KEY ("verificationProfileId") REFERENCES "SellerVerificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenSafetyReview" ADD CONSTRAINT "KitchenSafetyReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KitchenSafetyPhoto" ADD CONSTRAINT "KitchenSafetyPhoto_kitchenSafetyReviewId_fkey" FOREIGN KEY ("kitchenSafetyReviewId") REFERENCES "KitchenSafetyReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
