-- CreateEnum
CREATE TYPE "PreferredDeliveryMethod" AS ENUM ('pickup', 'delivery', 'in_store', 'no_preference');

-- CreateTable
CREATE TABLE "HouseholdPreferredCuisine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cuisineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdPreferredCuisine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdShoppingPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "preferredStoreName" TEXT,
    "preferredShoppingDay" TEXT,
    "preferredDeliveryMethod" "PreferredDeliveryMethod" NOT NULL DEFAULT 'no_preference',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdShoppingPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdPreferredCuisine_organizationId_idx" ON "HouseholdPreferredCuisine"("organizationId");

-- CreateIndex
CREATE INDEX "HouseholdPreferredCuisine_cuisineId_idx" ON "HouseholdPreferredCuisine"("cuisineId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdPreferredCuisine_organizationId_cuisineId_key" ON "HouseholdPreferredCuisine"("organizationId", "cuisineId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdShoppingPreference_organizationId_key" ON "HouseholdShoppingPreference"("organizationId");

-- CreateIndex
CREATE INDEX "HouseholdShoppingPreference_organizationId_idx" ON "HouseholdShoppingPreference"("organizationId");

-- AddForeignKey
ALTER TABLE "HouseholdPreferredCuisine" ADD CONSTRAINT "HouseholdPreferredCuisine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdPreferredCuisine" ADD CONSTRAINT "HouseholdPreferredCuisine_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdShoppingPreference" ADD CONSTRAINT "HouseholdShoppingPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
