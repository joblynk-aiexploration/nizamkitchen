-- CreateEnum
CREATE TYPE "RestaurantFallbackSearchStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "RestaurantProvider" AS ENUM ('maptiler', 'manual');

-- CreateTable
CREATE TABLE "RestaurantFallbackSearch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "recipeId" TEXT,
    "mealPlanEntryId" TEXT,
    "query" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "city" TEXT,
    "region" TEXT,
    "status" "RestaurantFallbackSearchStatus" NOT NULL DEFAULT 'pending',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantFallbackSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantFallbackResult" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "provider" "RestaurantProvider" NOT NULL DEFAULT 'maptiler',
    "providerPlaceId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "category" TEXT,
    "distanceMeters" DOUBLE PRECISION,
    "mapUrl" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantFallbackResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedRestaurant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "provider" "RestaurantProvider" NOT NULL DEFAULT 'manual',
    "providerPlaceId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "category" TEXT,
    "mapUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedRestaurant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantFallbackSearch_organizationId_idx" ON "RestaurantFallbackSearch"("organizationId");

-- CreateIndex
CREATE INDEX "RestaurantFallbackSearch_countryCode_idx" ON "RestaurantFallbackSearch"("countryCode");

-- CreateIndex
CREATE INDEX "RestaurantFallbackSearch_recipeId_idx" ON "RestaurantFallbackSearch"("recipeId");

-- CreateIndex
CREATE INDEX "RestaurantFallbackSearch_status_idx" ON "RestaurantFallbackSearch"("status");

-- CreateIndex
CREATE INDEX "RestaurantFallbackResult_searchId_idx" ON "RestaurantFallbackResult"("searchId");

-- CreateIndex
CREATE INDEX "RestaurantFallbackResult_organizationId_idx" ON "RestaurantFallbackResult"("organizationId");

-- CreateIndex
CREATE INDEX "SavedRestaurant_organizationId_idx" ON "SavedRestaurant"("organizationId");

-- CreateIndex
CREATE INDEX "SavedRestaurant_countryCode_idx" ON "SavedRestaurant"("countryCode");

-- AddForeignKey
ALTER TABLE "RestaurantFallbackSearch" ADD CONSTRAINT "RestaurantFallbackSearch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantFallbackSearch" ADD CONSTRAINT "RestaurantFallbackSearch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantFallbackSearch" ADD CONSTRAINT "RestaurantFallbackSearch_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantFallbackResult" ADD CONSTRAINT "RestaurantFallbackResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "RestaurantFallbackSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRestaurant" ADD CONSTRAINT "SavedRestaurant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
