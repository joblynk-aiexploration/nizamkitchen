ALTER TYPE "KitchenSafetyPhotoCategory" ADD VALUE IF NOT EXISTS 'waste_trash_area';
ALTER TYPE "KitchenSafetyPhotoCategory" ADD VALUE IF NOT EXISTS 'pet_separation';

CREATE TYPE "FoodSafetyCertificateStatus" AS ENUM ('submitted', 'approved', 'rejected', 'expired', 'needs_more_info');
CREATE TYPE "SellerPermitType" AS ENUM ('food_establishment_permit', 'cottage_food_registration', 'business_license', 'tax_registration', 'health_department_permit', 'other');
CREATE TYPE "SellerPermitStatus" AS ENUM ('submitted', 'approved', 'rejected', 'expired', 'needs_more_info');
CREATE TYPE "SellerTrialReviewStatus" AS ENUM ('not_required', 'requested', 'scheduled', 'submitted', 'approved', 'rejected', 'waived');

ALTER TABLE "KitchenSafetyReview" ADD COLUMN "checklistJson" JSONB;

CREATE TABLE "FoodSafetyCertificate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "verificationProfileId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "providerName" TEXT,
  "certificateNumber" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "countryCode" TEXT NOT NULL,
  "region" TEXT,
  "notes" TEXT,
  "status" "FoodSafetyCertificateStatus" NOT NULL DEFAULT 'submitted',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FoodSafetyCertificate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerPermit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "verificationProfileId" TEXT NOT NULL,
  "permitType" "SellerPermitType" NOT NULL,
  "fileId" TEXT NOT NULL,
  "issuingAuthority" TEXT,
  "permitNumber" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "status" "SellerPermitStatus" NOT NULL DEFAULT 'submitted',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerPermit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerTrialReview" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "verificationProfileId" TEXT NOT NULL,
  "status" "SellerTrialReviewStatus" NOT NULL DEFAULT 'requested',
  "scheduledAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "dishName" TEXT,
  "tasteScore" INTEGER,
  "packagingScore" INTEGER,
  "presentationScore" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerTrialReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FoodSafetyCertificate_organizationId_idx" ON "FoodSafetyCertificate"("organizationId");
CREATE INDEX "FoodSafetyCertificate_verificationProfileId_idx" ON "FoodSafetyCertificate"("verificationProfileId");
CREATE INDEX "FoodSafetyCertificate_fileId_idx" ON "FoodSafetyCertificate"("fileId");
CREATE INDEX "FoodSafetyCertificate_status_idx" ON "FoodSafetyCertificate"("status");
CREATE INDEX "FoodSafetyCertificate_expiresAt_idx" ON "FoodSafetyCertificate"("expiresAt");
CREATE INDEX "FoodSafetyCertificate_countryCode_idx" ON "FoodSafetyCertificate"("countryCode");
CREATE INDEX "FoodSafetyCertificate_region_idx" ON "FoodSafetyCertificate"("region");

CREATE INDEX "SellerPermit_organizationId_idx" ON "SellerPermit"("organizationId");
CREATE INDEX "SellerPermit_verificationProfileId_idx" ON "SellerPermit"("verificationProfileId");
CREATE INDEX "SellerPermit_permitType_idx" ON "SellerPermit"("permitType");
CREATE INDEX "SellerPermit_fileId_idx" ON "SellerPermit"("fileId");
CREATE INDEX "SellerPermit_status_idx" ON "SellerPermit"("status");
CREATE INDEX "SellerPermit_expiresAt_idx" ON "SellerPermit"("expiresAt");

CREATE INDEX "SellerTrialReview_organizationId_idx" ON "SellerTrialReview"("organizationId");
CREATE INDEX "SellerTrialReview_verificationProfileId_idx" ON "SellerTrialReview"("verificationProfileId");
CREATE INDEX "SellerTrialReview_status_idx" ON "SellerTrialReview"("status");
CREATE INDEX "SellerTrialReview_scheduledAt_idx" ON "SellerTrialReview"("scheduledAt");
CREATE INDEX "SellerTrialReview_reviewedById_idx" ON "SellerTrialReview"("reviewedById");

ALTER TABLE "FoodSafetyCertificate" ADD CONSTRAINT "FoodSafetyCertificate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FoodSafetyCertificate" ADD CONSTRAINT "FoodSafetyCertificate_verificationProfileId_fkey" FOREIGN KEY ("verificationProfileId") REFERENCES "SellerVerificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FoodSafetyCertificate" ADD CONSTRAINT "FoodSafetyCertificate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SellerPermit" ADD CONSTRAINT "SellerPermit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerPermit" ADD CONSTRAINT "SellerPermit_verificationProfileId_fkey" FOREIGN KEY ("verificationProfileId") REFERENCES "SellerVerificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerPermit" ADD CONSTRAINT "SellerPermit_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SellerTrialReview" ADD CONSTRAINT "SellerTrialReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerTrialReview" ADD CONSTRAINT "SellerTrialReview_verificationProfileId_fkey" FOREIGN KEY ("verificationProfileId") REFERENCES "SellerVerificationProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerTrialReview" ADD CONSTRAINT "SellerTrialReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
