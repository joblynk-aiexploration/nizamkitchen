-- CreateEnum
CREATE TYPE "CookingSkillLevel" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "AvoidedIngredientSeverity" AS ENUM ('preference', 'avoid', 'strict');

-- CreateTable
CREATE TABLE "HouseholdProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "defaultHouseholdSize" INTEGER NOT NULL,
    "adultsCount" INTEGER,
    "childrenCount" INTEGER,
    "defaultServings" INTEGER NOT NULL,
    "defaultSpiceLevel" "SpiceLevel" NOT NULL,
    "preferredMeasurementSystem" "MeasurementSystem" NOT NULL,
    "preferredCuisineIds" TEXT[],
    "cookingSkillLevel" "CookingSkillLevel" NOT NULL,
    "weeklyCookingDays" TEXT[],
    "groceryBudgetAmount" DOUBLE PRECISION,
    "groceryBudgetCurrency" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvoidedIngredient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "ingredientName" TEXT NOT NULL,
    "reason" TEXT,
    "severity" "AvoidedIngredientSeverity" NOT NULL DEFAULT 'avoid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvoidedIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteRecipe" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdPantryItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unitId" TEXT,
    "notes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdPantryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdProfile_organizationId_key" ON "HouseholdProfile"("organizationId");

-- CreateIndex
CREATE INDEX "HouseholdProfile_organizationId_idx" ON "HouseholdProfile"("organizationId");

-- CreateIndex
CREATE INDEX "HouseholdProfile_countryCode_idx" ON "HouseholdProfile"("countryCode");

-- CreateIndex
CREATE INDEX "HouseholdPreference_organizationId_idx" ON "HouseholdPreference"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdPreference_organizationId_key_key" ON "HouseholdPreference"("organizationId", "key");

-- CreateIndex
CREATE INDEX "AvoidedIngredient_organizationId_idx" ON "AvoidedIngredient"("organizationId");

-- CreateIndex
CREATE INDEX "AvoidedIngredient_ingredientId_idx" ON "AvoidedIngredient"("ingredientId");

-- CreateIndex
CREATE INDEX "FavoriteRecipe_organizationId_idx" ON "FavoriteRecipe"("organizationId");

-- CreateIndex
CREATE INDEX "FavoriteRecipe_recipeId_idx" ON "FavoriteRecipe"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteRecipe_organizationId_recipeId_key" ON "FavoriteRecipe"("organizationId", "recipeId");

-- CreateIndex
CREATE INDEX "HouseholdPantryItem_organizationId_idx" ON "HouseholdPantryItem"("organizationId");

-- CreateIndex
CREATE INDEX "HouseholdPantryItem_ingredientId_idx" ON "HouseholdPantryItem"("ingredientId");

-- CreateIndex
CREATE INDEX "HouseholdPantryItem_expiresAt_idx" ON "HouseholdPantryItem"("expiresAt");

-- AddForeignKey
ALTER TABLE "HouseholdProfile" ADD CONSTRAINT "HouseholdProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdPreference" ADD CONSTRAINT "HouseholdPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvoidedIngredient" ADD CONSTRAINT "AvoidedIngredient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvoidedIngredient" ADD CONSTRAINT "AvoidedIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteRecipe" ADD CONSTRAINT "FavoriteRecipe_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteRecipe" ADD CONSTRAINT "FavoriteRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteRecipe" ADD CONSTRAINT "FavoriteRecipe_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdPantryItem" ADD CONSTRAINT "HouseholdPantryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdPantryItem" ADD CONSTRAINT "HouseholdPantryItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdPantryItem" ADD CONSTRAINT "HouseholdPantryItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
