-- Replace active MapTiler provider usage with Google-backed location support.
ALTER TABLE "RestaurantFallbackResult" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION;
ALTER TABLE "RestaurantFallbackResult" ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER;
ALTER TABLE "RestaurantFallbackResult" ADD COLUMN IF NOT EXISTS "priceLevel" INTEGER;
ALTER TABLE "RestaurantFallbackResult" ADD COLUMN IF NOT EXISTS "openNow" BOOLEAN;
ALTER TABLE "SavedRestaurant" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION;
ALTER TABLE "SavedRestaurant" ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER;
ALTER TABLE "SavedRestaurant" ADD COLUMN IF NOT EXISTS "priceLevel" INTEGER;
ALTER TABLE "SavedRestaurant" ADD COLUMN IF NOT EXISTS "openNow" BOOLEAN;

ALTER TABLE "RestaurantFallbackResult" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "SavedRestaurant" ALTER COLUMN "provider" DROP DEFAULT;

-- Recreate the enum without the removed MapTiler value for fresh databases.
ALTER TABLE "RestaurantFallbackResult" ALTER COLUMN "provider" TYPE TEXT USING "provider"::text;
ALTER TABLE "SavedRestaurant" ALTER COLUMN "provider" TYPE TEXT USING "provider"::text;
UPDATE "RestaurantFallbackResult" SET "provider" = 'google' WHERE "provider" = 'maptiler';
UPDATE "SavedRestaurant" SET "provider" = 'google' WHERE "provider" = 'maptiler';
DROP TYPE "RestaurantProvider";
CREATE TYPE "RestaurantProvider" AS ENUM ('google', 'manual');
ALTER TABLE "RestaurantFallbackResult" ALTER COLUMN "provider" TYPE "RestaurantProvider" USING "provider"::"RestaurantProvider";
ALTER TABLE "SavedRestaurant" ALTER COLUMN "provider" TYPE "RestaurantProvider" USING "provider"::"RestaurantProvider";
ALTER TABLE "RestaurantFallbackResult" ALTER COLUMN "provider" SET DEFAULT 'google';
ALTER TABLE "SavedRestaurant" ALTER COLUMN "provider" SET DEFAULT 'manual';

DO $$ BEGIN
  CREATE TYPE "LocationProvider" AS ENUM ('google', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LocationVisibility" AS ENUM ('private', 'organization', 'public_city_only', 'public_full');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Location" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "label" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "countryCode" TEXT NOT NULL,
  "postalCode" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "provider" "LocationProvider" NOT NULL DEFAULT 'manual',
  "providerPlaceId" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "visibility" "LocationVisibility" NOT NULL DEFAULT 'private',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Location_entityType_entityId_isPrimary_key" ON "Location"("entityType", "entityId", "isPrimary");
CREATE INDEX IF NOT EXISTS "Location_organizationId_idx" ON "Location"("organizationId");
CREATE INDEX IF NOT EXISTS "Location_userId_idx" ON "Location"("userId");
CREATE INDEX IF NOT EXISTS "Location_countryCode_idx" ON "Location"("countryCode");
CREATE INDEX IF NOT EXISTS "Location_entityType_entityId_idx" ON "Location"("entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "Location"
  ADD CONSTRAINT "Location_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Location"
  ADD CONSTRAINT "Location_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
