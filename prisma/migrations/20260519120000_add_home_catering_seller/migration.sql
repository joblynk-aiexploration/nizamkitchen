-- CreateEnum
CREATE TYPE "HomeCateringProfileStatus" AS ENUM ('draft', 'active', 'paused', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "HomeCateringVerificationStatus" AS ENUM ('unverified', 'pending', 'verified', 'rejected');

-- AlterEnum
ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'home_catering';

-- CreateTable
CREATE TABLE "HomeCateringProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerName" TEXT,
    "bio" TEXT,
    "status" "HomeCateringProfileStatus" NOT NULL DEFAULT 'draft',
    "verificationStatus" "HomeCateringVerificationStatus" NOT NULL DEFAULT 'unverified',
    "profilePhotoUrl" TEXT,
    "coverPhotoUrl" TEXT,
    "cuisineSpecialtiesJson" JSONB NOT NULL,
    "languagesJson" JSONB NOT NULL,
    "serviceAreaText" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "acceptsPickup" BOOLEAN NOT NULL DEFAULT true,
    "acceptsDelivery" BOOLEAN NOT NULL DEFAULT false,
    "acceptsPreorders" BOOLEAN NOT NULL DEFAULT true,
    "minimumNoticeHours" INTEGER,
    "averageRating" DOUBLE PRECISION,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeCateringProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomeCateringProfile_organizationId_key" ON "HomeCateringProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeCateringProfile_slug_key" ON "HomeCateringProfile"("slug");

-- CreateIndex
CREATE INDEX "HomeCateringProfile_organizationId_idx" ON "HomeCateringProfile"("organizationId");

-- CreateIndex
CREATE INDEX "HomeCateringProfile_countryCode_idx" ON "HomeCateringProfile"("countryCode");

-- CreateIndex
CREATE INDEX "HomeCateringProfile_status_idx" ON "HomeCateringProfile"("status");

-- CreateIndex
CREATE INDEX "HomeCateringProfile_verificationStatus_idx" ON "HomeCateringProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "HomeCateringProfile_isPublic_idx" ON "HomeCateringProfile"("isPublic");

-- CreateIndex
CREATE INDEX "HomeCateringProfile_city_idx" ON "HomeCateringProfile"("city");

-- CreateIndex
CREATE INDEX "HomeCateringProfile_region_idx" ON "HomeCateringProfile"("region");

-- AddForeignKey
ALTER TABLE "HomeCateringProfile" ADD CONSTRAINT "HomeCateringProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
