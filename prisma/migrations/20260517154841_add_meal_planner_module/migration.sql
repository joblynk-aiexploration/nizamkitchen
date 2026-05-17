-- Rename the legacy lookup table so PostgreSQL can create the MealType enum.
ALTER TABLE "MealType" RENAME TO "MealTypeOption";
ALTER TABLE "MealTypeOption" RENAME CONSTRAINT "MealType_pkey" TO "MealTypeOption_pkey";
ALTER INDEX "MealType_name_key" RENAME TO "MealTypeOption_name_key";
ALTER INDEX "MealType_slug_key" RENAME TO "MealTypeOption_slug_key";

-- CreateEnum
CREATE TYPE "MealPlanStatus" AS ENUM ('draft', 'active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "MealPlanEntryStatus" AS ENUM ('planned', 'cooked', 'skipped', 'ordered_instead', 'replaced');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'side', 'prep');

-- AlterTable
ALTER TABLE "GroceryList" ADD COLUMN     "mealPlanId" TEXT;

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MealPlanStatus" NOT NULL DEFAULT 'draft',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "householdSize" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanDay" (
    "id" TEXT NOT NULL,
    "mealPlanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dayLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanEntry" (
    "id" TEXT NOT NULL,
    "mealPlanDayId" TEXT NOT NULL,
    "recipeId" TEXT,
    "customMealName" TEXT,
    "mealType" "MealType" NOT NULL,
    "targetServings" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "MealPlanEntryStatus" NOT NULL DEFAULT 'planned',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultHouseholdSize" INTEGER,
    "defaultCountryCode" TEXT,
    "preferredCuisines" TEXT[],
    "avoidedIngredients" TEXT[],
    "spicePreference" "SpiceLevel",
    "dietaryNotes" TEXT,
    "weeklyCookingDays" TEXT[],
    "measurementSystem" "MeasurementSystem",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealPlan_organizationId_idx" ON "MealPlan"("organizationId");

-- CreateIndex
CREATE INDEX "MealPlan_countryCode_idx" ON "MealPlan"("countryCode");

-- CreateIndex
CREATE INDEX "MealPlan_createdById_idx" ON "MealPlan"("createdById");

-- CreateIndex
CREATE INDEX "MealPlan_status_idx" ON "MealPlan"("status");

-- CreateIndex
CREATE INDEX "MealPlan_startDate_endDate_idx" ON "MealPlan"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "MealPlanDay_date_idx" ON "MealPlanDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanDay_mealPlanId_date_key" ON "MealPlanDay"("mealPlanId", "date");

-- CreateIndex
CREATE INDEX "MealPlanEntry_mealPlanDayId_idx" ON "MealPlanEntry"("mealPlanDayId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_recipeId_idx" ON "MealPlanEntry"("recipeId");

-- CreateIndex
CREATE INDEX "MealPlanEntry_mealType_idx" ON "MealPlanEntry"("mealType");

-- CreateIndex
CREATE INDEX "MealPlanEntry_status_idx" ON "MealPlanEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanPreference_organizationId_key" ON "MealPlanPreference"("organizationId");

-- CreateIndex
CREATE INDEX "MealPlanPreference_defaultCountryCode_idx" ON "MealPlanPreference"("defaultCountryCode");

-- CreateIndex
CREATE INDEX "GroceryList_mealPlanId_idx" ON "GroceryList"("mealPlanId");

-- AddForeignKey
ALTER TABLE "GroceryList" ADD CONSTRAINT "GroceryList_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_mealPlanDayId_fkey" FOREIGN KEY ("mealPlanDayId") REFERENCES "MealPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanEntry" ADD CONSTRAINT "MealPlanEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanPreference" ADD CONSTRAINT "MealPlanPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
