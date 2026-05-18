-- CreateEnum
CREATE TYPE "ChefProfileStatus" AS ENUM ('draft', 'active', 'paused', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "ChefVerificationStatus" AS ENUM ('unverified', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "ChefServiceType" AS ENUM ('daily_cooking', 'weekly_cooking', 'occasion', 'meal_prep', 'recipe_specific', 'custom');

-- CreateEnum
CREATE TYPE "ChefPriceUnit" AS ENUM ('per_visit', 'per_day', 'per_week', 'per_event', 'per_guest', 'custom');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'published', 'hidden');

-- CreateTable
CREATE TABLE "ChefProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "status" "ChefProfileStatus" NOT NULL DEFAULT 'draft',
    "verificationStatus" "ChefVerificationStatus" NOT NULL DEFAULT 'unverified',
    "profilePhotoUrl" TEXT,
    "languages" JSONB NOT NULL,
    "specialties" JSONB NOT NULL,
    "yearsExperience" INTEGER,
    "serviceRadiusKm" INTEGER,
    "baseCity" TEXT,
    "baseRegion" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "averageRating" DOUBLE PRECISION,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChefProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChefService" (
    "id" TEXT NOT NULL,
    "chefProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" "ChefServiceType" NOT NULL,
    "basePriceAmount" DOUBLE PRECISION,
    "currencyCode" TEXT NOT NULL,
    "priceUnit" "ChefPriceUnit" NOT NULL,
    "minGuests" INTEGER,
    "maxGuests" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChefService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChefSpecialtyRecipe" (
    "id" TEXT NOT NULL,
    "chefProfileId" TEXT NOT NULL,
    "recipeId" TEXT,
    "dishName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChefSpecialtyRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChefAvailability" (
    "id" TEXT NOT NULL,
    "chefProfileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChefAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChefReview" (
    "id" TEXT NOT NULL,
    "chefProfileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "homeChefRequestId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "ChefReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChefVerificationDocument" (
    "id" TEXT NOT NULL,
    "chefProfileId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileId" TEXT,
    "status" "ChefVerificationStatus" NOT NULL DEFAULT 'pending',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChefVerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChefProfile_organizationId_key" ON "ChefProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ChefProfile_slug_key" ON "ChefProfile"("slug");

-- CreateIndex
CREATE INDEX "ChefProfile_organizationId_idx" ON "ChefProfile"("organizationId");

-- CreateIndex
CREATE INDEX "ChefProfile_countryCode_idx" ON "ChefProfile"("countryCode");

-- CreateIndex
CREATE INDEX "ChefProfile_status_idx" ON "ChefProfile"("status");

-- CreateIndex
CREATE INDEX "ChefProfile_verificationStatus_idx" ON "ChefProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "ChefProfile_isPublic_idx" ON "ChefProfile"("isPublic");

-- CreateIndex
CREATE INDEX "ChefProfile_baseCity_idx" ON "ChefProfile"("baseCity");

-- CreateIndex
CREATE INDEX "ChefProfile_baseRegion_idx" ON "ChefProfile"("baseRegion");

-- CreateIndex
CREATE INDEX "ChefService_chefProfileId_idx" ON "ChefService"("chefProfileId");

-- CreateIndex
CREATE INDEX "ChefService_serviceType_idx" ON "ChefService"("serviceType");

-- CreateIndex
CREATE INDEX "ChefService_isActive_idx" ON "ChefService"("isActive");

-- CreateIndex
CREATE INDEX "ChefSpecialtyRecipe_chefProfileId_idx" ON "ChefSpecialtyRecipe"("chefProfileId");

-- CreateIndex
CREATE INDEX "ChefSpecialtyRecipe_recipeId_idx" ON "ChefSpecialtyRecipe"("recipeId");

-- CreateIndex
CREATE INDEX "ChefAvailability_chefProfileId_idx" ON "ChefAvailability"("chefProfileId");

-- CreateIndex
CREATE INDEX "ChefAvailability_dayOfWeek_idx" ON "ChefAvailability"("dayOfWeek");

-- CreateIndex
CREATE INDEX "ChefReview_chefProfileId_idx" ON "ChefReview"("chefProfileId");

-- CreateIndex
CREATE INDEX "ChefReview_organizationId_idx" ON "ChefReview"("organizationId");

-- CreateIndex
CREATE INDEX "ChefReview_homeChefRequestId_idx" ON "ChefReview"("homeChefRequestId");

-- CreateIndex
CREATE INDEX "ChefReview_status_idx" ON "ChefReview"("status");

-- CreateIndex
CREATE INDEX "ChefVerificationDocument_chefProfileId_idx" ON "ChefVerificationDocument"("chefProfileId");

-- CreateIndex
CREATE INDEX "ChefVerificationDocument_status_idx" ON "ChefVerificationDocument"("status");

-- AddForeignKey
ALTER TABLE "ChefProfile" ADD CONSTRAINT "ChefProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefService" ADD CONSTRAINT "ChefService_chefProfileId_fkey" FOREIGN KEY ("chefProfileId") REFERENCES "ChefProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefSpecialtyRecipe" ADD CONSTRAINT "ChefSpecialtyRecipe_chefProfileId_fkey" FOREIGN KEY ("chefProfileId") REFERENCES "ChefProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefSpecialtyRecipe" ADD CONSTRAINT "ChefSpecialtyRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefAvailability" ADD CONSTRAINT "ChefAvailability_chefProfileId_fkey" FOREIGN KEY ("chefProfileId") REFERENCES "ChefProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefReview" ADD CONSTRAINT "ChefReview_chefProfileId_fkey" FOREIGN KEY ("chefProfileId") REFERENCES "ChefProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefReview" ADD CONSTRAINT "ChefReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefReview" ADD CONSTRAINT "ChefReview_homeChefRequestId_fkey" FOREIGN KEY ("homeChefRequestId") REFERENCES "HomeChefRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefReview" ADD CONSTRAINT "ChefReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChefVerificationDocument" ADD CONSTRAINT "ChefVerificationDocument_chefProfileId_fkey" FOREIGN KEY ("chefProfileId") REFERENCES "ChefProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
