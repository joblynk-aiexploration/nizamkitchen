-- CreateEnum
CREATE TYPE "DishTemplateCategory" AS ENUM ('biryani', 'curry', 'salan', 'rice', 'bread', 'snack', 'dessert', 'drink', 'combo', 'catering_tray', 'special', 'other');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('draft', 'active', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "TemplateVisibility" AS ENUM ('internal_admin', 'public', 'seller_available', 'household_available');

-- CreateEnum
CREATE TYPE "MenuTemplateType" AS ENUM ('daily', 'weekly', 'monthly', 'occasion', 'ramadan', 'eid', 'wedding', 'party', 'custom');

-- CreateTable
CREATE TABLE "DishTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cuisineId" TEXT,
    "countryCode" TEXT,
    "region" TEXT,
    "city" TEXT,
    "mealType" "MealType",
    "category" "DishTemplateCategory" NOT NULL,
    "defaultServings" INTEGER,
    "defaultPriceAmount" DOUBLE PRECISION,
    "currencyCode" TEXT,
    "spiceLevel" "SpiceLevel",
    "status" "TemplateStatus" NOT NULL DEFAULT 'draft',
    "visibility" "TemplateVisibility" NOT NULL DEFAULT 'internal_admin',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DishTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishTemplateIngredient" (
    "id" TEXT NOT NULL,
    "dishTemplateId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "ingredientName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unitId" TEXT,
    "preparationNote" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DishTemplateIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishTemplateStep" (
    "id" TEXT NOT NULL,
    "dishTemplateId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "title" TEXT,
    "instruction" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DishTemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "templateType" "MenuTemplateType" NOT NULL,
    "countryCode" TEXT,
    "region" TEXT,
    "city" TEXT,
    "sellerType" "SellerType",
    "householdUseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sellerUseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "TemplateStatus" NOT NULL DEFAULT 'draft',
    "visibility" "TemplateVisibility" NOT NULL DEFAULT 'internal_admin',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuTemplateItem" (
    "id" TEXT NOT NULL,
    "menuTemplateId" TEXT NOT NULL,
    "dishTemplateId" TEXT,
    "recipeId" TEXT,
    "nameSnapshot" TEXT NOT NULL,
    "dayOffset" INTEGER,
    "mealSlot" "MealType",
    "category" "DishTemplateCategory",
    "quantity" DOUBLE PRECISION,
    "priceAmount" DOUBLE PRECISION,
    "currencyCode" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DishTemplate_slug_key" ON "DishTemplate"("slug");
CREATE INDEX "DishTemplate_cuisineId_idx" ON "DishTemplate"("cuisineId");
CREATE INDEX "DishTemplate_countryCode_idx" ON "DishTemplate"("countryCode");
CREATE INDEX "DishTemplate_region_idx" ON "DishTemplate"("region");
CREATE INDEX "DishTemplate_city_idx" ON "DishTemplate"("city");
CREATE INDEX "DishTemplate_mealType_idx" ON "DishTemplate"("mealType");
CREATE INDEX "DishTemplate_category_idx" ON "DishTemplate"("category");
CREATE INDEX "DishTemplate_status_idx" ON "DishTemplate"("status");
CREATE INDEX "DishTemplate_visibility_idx" ON "DishTemplate"("visibility");
CREATE INDEX "DishTemplate_createdById_idx" ON "DishTemplate"("createdById");
CREATE INDEX "DishTemplateIngredient_dishTemplateId_idx" ON "DishTemplateIngredient"("dishTemplateId");
CREATE INDEX "DishTemplateIngredient_ingredientId_idx" ON "DishTemplateIngredient"("ingredientId");
CREATE INDEX "DishTemplateIngredient_unitId_idx" ON "DishTemplateIngredient"("unitId");
CREATE INDEX "DishTemplateStep_dishTemplateId_idx" ON "DishTemplateStep"("dishTemplateId");
CREATE INDEX "DishTemplateStep_stepNumber_idx" ON "DishTemplateStep"("stepNumber");
CREATE UNIQUE INDEX "MenuTemplate_slug_key" ON "MenuTemplate"("slug");
CREATE INDEX "MenuTemplate_templateType_idx" ON "MenuTemplate"("templateType");
CREATE INDEX "MenuTemplate_countryCode_idx" ON "MenuTemplate"("countryCode");
CREATE INDEX "MenuTemplate_region_idx" ON "MenuTemplate"("region");
CREATE INDEX "MenuTemplate_city_idx" ON "MenuTemplate"("city");
CREATE INDEX "MenuTemplate_sellerType_idx" ON "MenuTemplate"("sellerType");
CREATE INDEX "MenuTemplate_householdUseEnabled_idx" ON "MenuTemplate"("householdUseEnabled");
CREATE INDEX "MenuTemplate_sellerUseEnabled_idx" ON "MenuTemplate"("sellerUseEnabled");
CREATE INDEX "MenuTemplate_status_idx" ON "MenuTemplate"("status");
CREATE INDEX "MenuTemplate_visibility_idx" ON "MenuTemplate"("visibility");
CREATE INDEX "MenuTemplateItem_menuTemplateId_idx" ON "MenuTemplateItem"("menuTemplateId");
CREATE INDEX "MenuTemplateItem_dishTemplateId_idx" ON "MenuTemplateItem"("dishTemplateId");
CREATE INDEX "MenuTemplateItem_recipeId_idx" ON "MenuTemplateItem"("recipeId");
CREATE INDEX "MenuTemplateItem_mealSlot_idx" ON "MenuTemplateItem"("mealSlot");
CREATE INDEX "MenuTemplateItem_category_idx" ON "MenuTemplateItem"("category");
CREATE INDEX "MenuTemplateItem_displayOrder_idx" ON "MenuTemplateItem"("displayOrder");

-- AddForeignKey
ALTER TABLE "DishTemplate" ADD CONSTRAINT "DishTemplate_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DishTemplate" ADD CONSTRAINT "DishTemplate_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DishTemplate" ADD CONSTRAINT "DishTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DishTemplate" ADD CONSTRAINT "DishTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DishTemplateIngredient" ADD CONSTRAINT "DishTemplateIngredient_dishTemplateId_fkey" FOREIGN KEY ("dishTemplateId") REFERENCES "DishTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DishTemplateIngredient" ADD CONSTRAINT "DishTemplateIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DishTemplateIngredient" ADD CONSTRAINT "DishTemplateIngredient_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DishTemplateStep" ADD CONSTRAINT "DishTemplateStep_dishTemplateId_fkey" FOREIGN KEY ("dishTemplateId") REFERENCES "DishTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuTemplate" ADD CONSTRAINT "MenuTemplate_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MenuTemplate" ADD CONSTRAINT "MenuTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuTemplate" ADD CONSTRAINT "MenuTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MenuTemplateItem" ADD CONSTRAINT "MenuTemplateItem_menuTemplateId_fkey" FOREIGN KEY ("menuTemplateId") REFERENCES "MenuTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuTemplateItem" ADD CONSTRAINT "MenuTemplateItem_dishTemplateId_fkey" FOREIGN KEY ("dishTemplateId") REFERENCES "DishTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MenuTemplateItem" ADD CONSTRAINT "MenuTemplateItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
