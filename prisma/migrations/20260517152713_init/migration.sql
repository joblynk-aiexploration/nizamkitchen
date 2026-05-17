-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('platform_owner', 'platform_admin', 'country_manager', 'support_admin', 'auditor');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('org_owner', 'org_admin', 'member', 'chef_owner', 'chef_staff', 'restaurant_owner', 'restaurant_staff', 'grocery_partner_admin');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('household', 'chef_business', 'restaurant', 'grocery_partner', 'internal_admin');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'invited', 'suspended', 'removed');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'paused', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "MeasurementSystem" AS ENUM ('metric', 'imperial', 'mixed');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'disabled');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('mass', 'volume', 'count', 'length', 'package', 'custom');

-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('metric', 'imperial', 'mixed', 'traditional');

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('vegetable', 'fruit', 'meat', 'poultry', 'seafood', 'dairy', 'grain', 'lentil', 'spice', 'herb', 'oil', 'condiment', 'nut', 'sweetener', 'beverage', 'packaged', 'other');

-- CreateEnum
CREATE TYPE "RecipeDifficulty" AS ENUM ('easy', 'medium', 'hard', 'expert');

-- CreateEnum
CREATE TYPE "SpiceLevel" AS ENUM ('mild', 'medium', 'hot', 'extra_hot');

-- CreateEnum
CREATE TYPE "RecipeVisibility" AS ENUM ('global', 'organization', 'private');

-- CreateEnum
CREATE TYPE "RecipeSourceType" AS ENUM ('platform', 'organization', 'imported', 'user_created');

-- CreateEnum
CREATE TYPE "MediaReferenceType" AS ENUM ('youtube', 'image', 'article', 'other');

-- CreateEnum
CREATE TYPE "GroceryListStatus" AS ENUM ('draft', 'active', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "GroceryListSourceType" AS ENUM ('manual', 'recipes', 'meal_plan');

-- CreateEnum
CREATE TYPE "GroceryMergeStatus" AS ENUM ('merged', 'separate', 'needs_review', 'conversion_failed');

-- CreateEnum
CREATE TYPE "GroceryConfidence" AS ENUM ('exact', 'high', 'medium', 'low', 'unknown');

-- CreateEnum
CREATE TYPE "WarningSeverity" AS ENUM ('info', 'warning', 'error');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "platformRole" "PlatformRole",
    "preferredLocale" TEXT DEFAULT 'en-US',
    "preferredTimezone" TEXT DEFAULT 'UTC',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "organizationType" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'active',
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "defaultTimezone" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL,
    "measurementSystem" "MeasurementSystem" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "defaultTimezone" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL,
    "measurementSystem" "MeasurementSystem" NOT NULL,
    "phoneCountryCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supportedModules" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountryAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CountryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountryConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "countryCode" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "configValue" JSONB NOT NULL,
    "measurementSystem" "MeasurementSystem",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "organizationId" TEXT,
    "countryCode" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "countryCode" TEXT,
    "templateKey" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuisine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "countryCode" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuisine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "system" "UnitSystem" NOT NULL,
    "symbol" TEXT,
    "isBaseUnit" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "countryCode" TEXT,
    "name" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "IngredientCategory" NOT NULL,
    "defaultUnitId" TEXT,
    "densityGramPerMl" DOUBLE PRECISION,
    "averagePieceWeightGrams" DOUBLE PRECISION,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientAlias" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "language" TEXT,
    "countryCode" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitConversion" (
    "id" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "offset" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "notes" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "countryCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "countryCode" TEXT,
    "cuisineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "story" TEXT,
    "difficulty" "RecipeDifficulty" NOT NULL,
    "spiceLevel" "SpiceLevel" NOT NULL,
    "prepMinutes" INTEGER NOT NULL,
    "cookMinutes" INTEGER NOT NULL,
    "restMinutes" INTEGER,
    "servings" INTEGER NOT NULL,
    "servingUnit" TEXT NOT NULL DEFAULT 'serving',
    "visibility" "RecipeVisibility" NOT NULL DEFAULT 'global',
    "sourceType" "RecipeSourceType" NOT NULL,
    "createdById" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitId" TEXT NOT NULL,
    "preparationNote" TEXT,
    "section" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "title" TEXT,
    "instruction" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "temperature" TEXT,
    "tips" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeMediaReference" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "type" "MediaReferenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "language" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeMediaReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietaryTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "DietaryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeDietaryTag" (
    "recipeId" TEXT NOT NULL,
    "dietaryTagId" TEXT NOT NULL,

    CONSTRAINT "RecipeDietaryTag_pkey" PRIMARY KEY ("recipeId","dietaryTagId")
);

-- CreateTable
CREATE TABLE "MealType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MealType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryList" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GroceryListStatus" NOT NULL DEFAULT 'draft',
    "sourceType" "GroceryListSourceType" NOT NULL DEFAULT 'recipes',
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "householdSize" INTEGER,
    "notes" TEXT,
    "calculationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryListRecipe" (
    "id" TEXT NOT NULL,
    "groceryListId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "recipeNameSnapshot" TEXT NOT NULL,
    "originalServings" INTEGER NOT NULL,
    "targetServings" INTEGER NOT NULL,
    "scaleFactor" DOUBLE PRECISION NOT NULL,
    "mealSlot" TEXT,
    "plannedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryListRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryListItem" (
    "id" TEXT NOT NULL,
    "groceryListId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "ingredientNameSnapshot" TEXT NOT NULL,
    "canonicalIngredientName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "totalQuantity" DOUBLE PRECISION NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitNameSnapshot" TEXT NOT NULL,
    "displayQuantity" DOUBLE PRECISION NOT NULL,
    "displayUnit" TEXT NOT NULL,
    "confidence" "GroceryConfidence" NOT NULL DEFAULT 'unknown',
    "mergeStatus" "GroceryMergeStatus" NOT NULL DEFAULT 'separate',
    "notes" TEXT,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryListItemSource" (
    "id" TEXT NOT NULL,
    "groceryListItemId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "recipeNameSnapshot" TEXT NOT NULL,
    "recipeIngredientId" TEXT,
    "originalQuantity" DOUBLE PRECISION NOT NULL,
    "originalUnitId" TEXT NOT NULL,
    "originalUnitNameSnapshot" TEXT NOT NULL,
    "scaledQuantity" DOUBLE PRECISION NOT NULL,
    "scaledUnitId" TEXT NOT NULL,
    "scaledUnitNameSnapshot" TEXT NOT NULL,
    "conversionApplied" BOOLEAN NOT NULL DEFAULT false,
    "conversionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "warning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryListItemSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryConversionWarning" (
    "id" TEXT NOT NULL,
    "groceryListId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "message" TEXT NOT NULL,
    "severity" "WarningSeverity" NOT NULL DEFAULT 'warning',
    "sourceRecipeId" TEXT,
    "sourceRecipeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryConversionWarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_activeOrganizationId_idx" ON "Session"("activeOrganizationId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_organizationId_key" ON "Organization"("organizationId");

-- CreateIndex
CREATE INDEX "Organization_countryCode_idx" ON "Organization"("countryCode");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE INDEX "Membership_status_idx" ON "Membership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Country_countryCode_key" ON "Country"("countryCode");

-- CreateIndex
CREATE INDEX "CountryAssignment_countryCode_idx" ON "CountryAssignment"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "CountryAssignment_userId_countryCode_key" ON "CountryAssignment"("userId", "countryCode");

-- CreateIndex
CREATE INDEX "CountryConfig_countryCode_idx" ON "CountryConfig"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "CountryConfig_organizationId_countryCode_configKey_key" ON "CountryConfig"("organizationId", "countryCode", "configKey");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_countryCode_idx" ON "AuditLog"("countryCode");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "FeatureFlag_organizationId_idx" ON "FeatureFlag"("organizationId");

-- CreateIndex
CREATE INDEX "FeatureFlag_countryCode_idx" ON "FeatureFlag"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_organizationId_countryCode_key" ON "FeatureFlag"("key", "organizationId", "countryCode");

-- CreateIndex
CREATE INDEX "BillingSubscription_organizationId_idx" ON "BillingSubscription"("organizationId");

-- CreateIndex
CREATE INDEX "BillingSubscription_countryCode_idx" ON "BillingSubscription"("countryCode");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "StorageFile_organizationId_idx" ON "StorageFile"("organizationId");

-- CreateIndex
CREATE INDEX "StorageFile_countryCode_idx" ON "StorageFile"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "StorageFile_bucket_storageKey_key" ON "StorageFile"("bucket", "storageKey");

-- CreateIndex
CREATE INDEX "EmailLog_organizationId_idx" ON "EmailLog"("organizationId");

-- CreateIndex
CREATE INDEX "EmailLog_countryCode_idx" ON "EmailLog"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Cuisine_slug_key" ON "Cuisine"("slug");

-- CreateIndex
CREATE INDEX "Cuisine_countryCode_idx" ON "Cuisine"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE INDEX "Unit_type_idx" ON "Unit"("type");

-- CreateIndex
CREATE INDEX "Unit_system_idx" ON "Unit"("system");

-- CreateIndex
CREATE INDEX "Ingredient_organizationId_idx" ON "Ingredient"("organizationId");

-- CreateIndex
CREATE INDEX "Ingredient_countryCode_idx" ON "Ingredient"("countryCode");

-- CreateIndex
CREATE INDEX "Ingredient_category_idx" ON "Ingredient"("category");

-- CreateIndex
CREATE INDEX "Ingredient_isGlobal_idx" ON "Ingredient"("isGlobal");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_slug_organizationId_key" ON "Ingredient"("slug", "organizationId");

-- CreateIndex
CREATE INDEX "IngredientAlias_ingredientId_idx" ON "IngredientAlias"("ingredientId");

-- CreateIndex
CREATE INDEX "IngredientAlias_alias_idx" ON "IngredientAlias"("alias");

-- CreateIndex
CREATE INDEX "UnitConversion_fromUnitId_toUnitId_idx" ON "UnitConversion"("fromUnitId", "toUnitId");

-- CreateIndex
CREATE INDEX "UnitConversion_ingredientId_idx" ON "UnitConversion"("ingredientId");

-- CreateIndex
CREATE INDEX "UnitConversion_isGlobal_idx" ON "UnitConversion"("isGlobal");

-- CreateIndex
CREATE INDEX "Recipe_organizationId_idx" ON "Recipe"("organizationId");

-- CreateIndex
CREATE INDEX "Recipe_countryCode_idx" ON "Recipe"("countryCode");

-- CreateIndex
CREATE INDEX "Recipe_cuisineId_idx" ON "Recipe"("cuisineId");

-- CreateIndex
CREATE INDEX "Recipe_isPublished_idx" ON "Recipe"("isPublished");

-- CreateIndex
CREATE INDEX "Recipe_visibility_idx" ON "Recipe"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_organizationId_key" ON "Recipe"("slug", "organizationId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_ingredientId_idx" ON "RecipeIngredient"("ingredientId");

-- CreateIndex
CREATE INDEX "RecipeStep_recipeId_idx" ON "RecipeStep"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStep_recipeId_stepNumber_key" ON "RecipeStep"("recipeId", "stepNumber");

-- CreateIndex
CREATE INDEX "RecipeMediaReference_recipeId_idx" ON "RecipeMediaReference"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "DietaryTag_name_key" ON "DietaryTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DietaryTag_slug_key" ON "DietaryTag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MealType_name_key" ON "MealType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MealType_slug_key" ON "MealType"("slug");

-- CreateIndex
CREATE INDEX "GroceryList_organizationId_idx" ON "GroceryList"("organizationId");

-- CreateIndex
CREATE INDEX "GroceryList_createdById_idx" ON "GroceryList"("createdById");

-- CreateIndex
CREATE INDEX "GroceryList_status_idx" ON "GroceryList"("status");

-- CreateIndex
CREATE INDEX "GroceryListRecipe_groceryListId_idx" ON "GroceryListRecipe"("groceryListId");

-- CreateIndex
CREATE INDEX "GroceryListRecipe_recipeId_idx" ON "GroceryListRecipe"("recipeId");

-- CreateIndex
CREATE INDEX "GroceryListItem_groceryListId_idx" ON "GroceryListItem"("groceryListId");

-- CreateIndex
CREATE INDEX "GroceryListItem_ingredientId_idx" ON "GroceryListItem"("ingredientId");

-- CreateIndex
CREATE INDEX "GroceryListItem_isChecked_idx" ON "GroceryListItem"("isChecked");

-- CreateIndex
CREATE INDEX "GroceryListItemSource_groceryListItemId_idx" ON "GroceryListItemSource"("groceryListItemId");

-- CreateIndex
CREATE INDEX "GroceryListItemSource_recipeId_idx" ON "GroceryListItemSource"("recipeId");

-- CreateIndex
CREATE INDEX "GroceryConversionWarning_groceryListId_idx" ON "GroceryConversionWarning"("groceryListId");

-- CreateIndex
CREATE INDEX "GroceryConversionWarning_ingredientId_idx" ON "GroceryConversionWarning"("ingredientId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountryAssignment" ADD CONSTRAINT "CountryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountryAssignment" ADD CONSTRAINT "CountryAssignment_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountryConfig" ADD CONSTRAINT "CountryConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountryConfig" ADD CONSTRAINT "CountryConfig_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageFile" ADD CONSTRAINT "StorageFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_defaultUnitId_fkey" FOREIGN KEY ("defaultUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitConversion" ADD CONSTRAINT "UnitConversion_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_cuisineId_fkey" FOREIGN KEY ("cuisineId") REFERENCES "Cuisine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeMediaReference" ADD CONSTRAINT "RecipeMediaReference_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeDietaryTag" ADD CONSTRAINT "RecipeDietaryTag_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeDietaryTag" ADD CONSTRAINT "RecipeDietaryTag_dietaryTagId_fkey" FOREIGN KEY ("dietaryTagId") REFERENCES "DietaryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryList" ADD CONSTRAINT "GroceryList_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryList" ADD CONSTRAINT "GroceryList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListRecipe" ADD CONSTRAINT "GroceryListRecipe_groceryListId_fkey" FOREIGN KEY ("groceryListId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListRecipe" ADD CONSTRAINT "GroceryListRecipe_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListItem" ADD CONSTRAINT "GroceryListItem_groceryListId_fkey" FOREIGN KEY ("groceryListId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListItem" ADD CONSTRAINT "GroceryListItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListItem" ADD CONSTRAINT "GroceryListItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListItemSource" ADD CONSTRAINT "GroceryListItemSource_groceryListItemId_fkey" FOREIGN KEY ("groceryListItemId") REFERENCES "GroceryListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListItemSource" ADD CONSTRAINT "GroceryListItemSource_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListItemSource" ADD CONSTRAINT "GroceryListItemSource_originalUnitId_fkey" FOREIGN KEY ("originalUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryListItemSource" ADD CONSTRAINT "GroceryListItemSource_scaledUnitId_fkey" FOREIGN KEY ("scaledUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryConversionWarning" ADD CONSTRAINT "GroceryConversionWarning_groceryListId_fkey" FOREIGN KEY ("groceryListId") REFERENCES "GroceryList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryConversionWarning" ADD CONSTRAINT "GroceryConversionWarning_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryConversionWarning" ADD CONSTRAINT "GroceryConversionWarning_sourceRecipeId_fkey" FOREIGN KEY ("sourceRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
