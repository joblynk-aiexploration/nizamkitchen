-- CreateEnum
CREATE TYPE "LocaleTextDirection" AS ENUM ('ltr', 'rtl');

-- CreateEnum
CREATE TYPE "LocalizationStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('draft', 'published', 'disabled');

-- CreateTable
CREATE TABLE "LocalizationLocale" (
    "id" TEXT NOT NULL,
    "localeCode" TEXT NOT NULL,
    "languageName" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "textDirection" "LocaleTextDirection" NOT NULL DEFAULT 'ltr',
    "status" "LocalizationStatus" NOT NULL DEFAULT 'active',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "dateFormat" TEXT NOT NULL,
    "timeFormat" TEXT NOT NULL,
    "numberFormat" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalizationLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalizationTranslation" (
    "id" TEXT NOT NULL,
    "localeCode" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "translationKey" TEXT NOT NULL,
    "defaultValue" TEXT NOT NULL,
    "translatedValue" TEXT NOT NULL,
    "status" "TranslationStatus" NOT NULL DEFAULT 'published',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalizationTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencySetting" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimalDigits" INTEGER NOT NULL DEFAULT 2,
    "status" "LocalizationStatus" NOT NULL DEFAULT 'active',
    "countryCodesJson" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountryRegionalSetting" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL,
    "supportedLocalesJson" JSONB NOT NULL,
    "supportedCurrencyCodesJson" JSONB NOT NULL,
    "measurementSystem" "MeasurementSystem" NOT NULL,
    "dateFormat" TEXT NOT NULL,
    "timeFormat" TEXT NOT NULL,
    "addressFormatJson" JSONB NOT NULL,
    "rtlEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryRegionalSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodTerminologyAlias" (
    "id" TEXT NOT NULL,
    "localeCode" TEXT,
    "countryCode" TEXT,
    "ingredientId" TEXT,
    "sourceTerm" TEXT NOT NULL,
    "localizedTerm" TEXT NOT NULL,
    "transliteration" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodTerminologyAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLocalizationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localeCode" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "measurementSystem" "MeasurementSystem",
    "currencyCode" TEXT,
    "dateFormat" TEXT,
    "timeFormat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocalizationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalizationLocale_localeCode_key" ON "LocalizationLocale"("localeCode");

-- CreateIndex
CREATE INDEX "LocalizationLocale_status_idx" ON "LocalizationLocale"("status");

-- CreateIndex
CREATE INDEX "LocalizationLocale_textDirection_idx" ON "LocalizationLocale"("textDirection");

-- CreateIndex
CREATE INDEX "LocalizationTranslation_namespace_idx" ON "LocalizationTranslation"("namespace");

-- CreateIndex
CREATE INDEX "LocalizationTranslation_status_idx" ON "LocalizationTranslation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LocalizationTranslation_localeCode_namespace_translationKey_key" ON "LocalizationTranslation"("localeCode", "namespace", "translationKey");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencySetting_currencyCode_key" ON "CurrencySetting"("currencyCode");

-- CreateIndex
CREATE INDEX "CurrencySetting_status_idx" ON "CurrencySetting"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CountryRegionalSetting_countryCode_key" ON "CountryRegionalSetting"("countryCode");

-- CreateIndex
CREATE INDEX "CountryRegionalSetting_defaultLocale_idx" ON "CountryRegionalSetting"("defaultLocale");

-- CreateIndex
CREATE INDEX "CountryRegionalSetting_measurementSystem_idx" ON "CountryRegionalSetting"("measurementSystem");

-- CreateIndex
CREATE INDEX "FoodTerminologyAlias_localeCode_idx" ON "FoodTerminologyAlias"("localeCode");

-- CreateIndex
CREATE INDEX "FoodTerminologyAlias_countryCode_idx" ON "FoodTerminologyAlias"("countryCode");

-- CreateIndex
CREATE INDEX "FoodTerminologyAlias_ingredientId_idx" ON "FoodTerminologyAlias"("ingredientId");

-- CreateIndex
CREATE INDEX "FoodTerminologyAlias_sourceTerm_idx" ON "FoodTerminologyAlias"("sourceTerm");

-- CreateIndex
CREATE UNIQUE INDEX "UserLocalizationPreference_userId_key" ON "UserLocalizationPreference"("userId");

-- CreateIndex
CREATE INDEX "UserLocalizationPreference_localeCode_idx" ON "UserLocalizationPreference"("localeCode");

-- CreateIndex
CREATE INDEX "UserLocalizationPreference_currencyCode_idx" ON "UserLocalizationPreference"("currencyCode");

-- AddForeignKey
ALTER TABLE "LocalizationTranslation" ADD CONSTRAINT "LocalizationTranslation_localeCode_fkey" FOREIGN KEY ("localeCode") REFERENCES "LocalizationLocale"("localeCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountryRegionalSetting" ADD CONSTRAINT "CountryRegionalSetting_countryCode_fkey" FOREIGN KEY ("countryCode") REFERENCES "Country"("countryCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodTerminologyAlias" ADD CONSTRAINT "FoodTerminologyAlias_localeCode_fkey" FOREIGN KEY ("localeCode") REFERENCES "LocalizationLocale"("localeCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodTerminologyAlias" ADD CONSTRAINT "FoodTerminologyAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocalizationPreference" ADD CONSTRAINT "UserLocalizationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocalizationPreference" ADD CONSTRAINT "UserLocalizationPreference_localeCode_fkey" FOREIGN KEY ("localeCode") REFERENCES "LocalizationLocale"("localeCode") ON DELETE RESTRICT ON UPDATE CASCADE;
