-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('promo_code', 'seller_discount', 'referral_reward', 'loyalty_credit', 'manual_credit');

-- CreateEnum
CREATE TYPE "PromotionDiscountType" AS ENUM ('percent', 'fixed_amount', 'free_delivery', 'credit_amount');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('draft', 'active', 'disabled', 'expired', 'archived');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('platform', 'seller');

-- CreateEnum
CREATE TYPE "PromotionModule" AS ENUM ('food_order', 'home_chef_request', 'subscription');

-- CreateEnum
CREATE TYPE "PromotionRedemptionStatus" AS ENUM ('reserved', 'applied', 'voided', 'refunded');

-- CreateEnum
CREATE TYPE "PlatformCreditAccountStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "PlatformCreditLedgerType" AS ENUM ('grant', 'redeem', 'refund', 'adjustment', 'expiry');

-- CreateEnum
CREATE TYPE "ReferralCodeStatus" AS ENUM ('active', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "ReferralEventStatus" AS ENUM ('started', 'qualified', 'rewarded', 'cancelled');

-- AlterTable
ALTER TABLE "FoodOrder"
  ADD COLUMN "promotionCode" TEXT,
  ADD COLUMN "promotionDiscountAmount" DOUBLE PRECISION,
  ADD COLUMN "platformCreditAppliedAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "HomeChefRequest"
  ADD COLUMN "promotionCode" TEXT,
  ADD COLUMN "promotionDiscountAmount" DOUBLE PRECISION,
  ADD COLUMN "platformCreditAppliedAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PaymentOrder"
  ADD COLUMN "discountAmount" DECIMAL(10,2),
  ADD COLUMN "platformCreditAmount" DECIMAL(10,2),
  ADD COLUMN "promotionCode" TEXT,
  ADD COLUMN "promotionRedemptionId" TEXT;

-- CreateTable
CREATE TABLE "Promotion" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "promotionType" "PromotionType" NOT NULL DEFAULT 'promo_code',
  "discountType" "PromotionDiscountType" NOT NULL,
  "status" "PromotionStatus" NOT NULL DEFAULT 'draft',
  "scope" "PromotionScope" NOT NULL DEFAULT 'platform',
  "sellerOrganizationId" TEXT,
  "countryCode" TEXT,
  "region" TEXT,
  "city" TEXT,
  "currencyCode" TEXT,
  "percentOff" DECIMAL(5,2),
  "amountOff" DECIMAL(10,2),
  "minOrderAmount" DECIMAL(10,2),
  "maxDiscountAmount" DECIMAL(10,2),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "perUserLimit" INTEGER,
  "appliesToFoodOrders" BOOLEAN NOT NULL DEFAULT true,
  "appliesToHomeChefRequests" BOOLEAN NOT NULL DEFAULT true,
  "appliesToSubscriptions" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRedemption" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "userId" TEXT,
  "organizationId" TEXT,
  "sellerOrganizationId" TEXT,
  "countryCode" TEXT,
  "city" TEXT,
  "module" "PromotionModule" NOT NULL,
  "moduleEntityId" TEXT NOT NULL,
  "foodOrderId" TEXT,
  "homeChefRequestId" TEXT,
  "billingSubscriptionId" TEXT,
  "paymentOrderId" TEXT,
  "originalAmount" DECIMAL(10,2) NOT NULL,
  "discountAmount" DECIMAL(10,2) NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "status" "PromotionRedemptionStatus" NOT NULL DEFAULT 'applied',
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCreditAccount" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT,
  "currencyCode" TEXT NOT NULL,
  "balanceAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" "PlatformCreditAccountStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformCreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCreditLedgerEntry" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "entryType" "PlatformCreditLedgerType" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "balanceAfter" DECIMAL(10,2) NOT NULL,
  "reason" TEXT,
  "createdById" TEXT,
  "promotionRedemptionId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PlatformCreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "ownerOrganizationId" TEXT,
  "countryCode" TEXT,
  "city" TEXT,
  "status" "ReferralCodeStatus" NOT NULL DEFAULT 'active',
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "rewardCreditAmount" DECIMAL(10,2),
  "rewardCurrencyCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralEvent" (
  "id" TEXT NOT NULL,
  "referralCodeId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "referredOrganizationId" TEXT,
  "status" "ReferralEventStatus" NOT NULL DEFAULT 'started',
  "rewardCreditAmount" DECIMAL(10,2),
  "rewardCurrencyCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");
CREATE INDEX "Promotion_code_idx" ON "Promotion"("code");
CREATE INDEX "Promotion_status_idx" ON "Promotion"("status");
CREATE INDEX "Promotion_scope_idx" ON "Promotion"("scope");
CREATE INDEX "Promotion_sellerOrganizationId_idx" ON "Promotion"("sellerOrganizationId");
CREATE INDEX "Promotion_countryCode_region_city_idx" ON "Promotion"("countryCode", "region", "city");
CREATE INDEX "Promotion_currencyCode_idx" ON "Promotion"("currencyCode");
CREATE INDEX "Promotion_startsAt_endsAt_idx" ON "Promotion"("startsAt", "endsAt");
CREATE INDEX "Promotion_createdAt_idx" ON "Promotion"("createdAt");
CREATE UNIQUE INDEX "PromotionRedemption_promotionId_module_moduleEntityId_key" ON "PromotionRedemption"("promotionId", "module", "moduleEntityId");
CREATE INDEX "PromotionRedemption_promotionId_idx" ON "PromotionRedemption"("promotionId");
CREATE INDEX "PromotionRedemption_userId_idx" ON "PromotionRedemption"("userId");
CREATE INDEX "PromotionRedemption_organizationId_idx" ON "PromotionRedemption"("organizationId");
CREATE INDEX "PromotionRedemption_sellerOrganizationId_idx" ON "PromotionRedemption"("sellerOrganizationId");
CREATE INDEX "PromotionRedemption_countryCode_city_idx" ON "PromotionRedemption"("countryCode", "city");
CREATE INDEX "PromotionRedemption_module_moduleEntityId_idx" ON "PromotionRedemption"("module", "moduleEntityId");
CREATE INDEX "PromotionRedemption_status_idx" ON "PromotionRedemption"("status");
CREATE INDEX "PromotionRedemption_createdAt_idx" ON "PromotionRedemption"("createdAt");
CREATE UNIQUE INDEX "PlatformCreditAccount_organizationId_currencyCode_key" ON "PlatformCreditAccount"("organizationId", "currencyCode");
CREATE UNIQUE INDEX "PlatformCreditAccount_userId_currencyCode_key" ON "PlatformCreditAccount"("userId", "currencyCode");
CREATE INDEX "PlatformCreditAccount_organizationId_idx" ON "PlatformCreditAccount"("organizationId");
CREATE INDEX "PlatformCreditAccount_userId_idx" ON "PlatformCreditAccount"("userId");
CREATE INDEX "PlatformCreditAccount_currencyCode_idx" ON "PlatformCreditAccount"("currencyCode");
CREATE INDEX "PlatformCreditAccount_status_idx" ON "PlatformCreditAccount"("status");
CREATE INDEX "PlatformCreditLedgerEntry_accountId_idx" ON "PlatformCreditLedgerEntry"("accountId");
CREATE INDEX "PlatformCreditLedgerEntry_entryType_idx" ON "PlatformCreditLedgerEntry"("entryType");
CREATE INDEX "PlatformCreditLedgerEntry_createdById_idx" ON "PlatformCreditLedgerEntry"("createdById");
CREATE INDEX "PlatformCreditLedgerEntry_promotionRedemptionId_idx" ON "PlatformCreditLedgerEntry"("promotionRedemptionId");
CREATE INDEX "PlatformCreditLedgerEntry_createdAt_idx" ON "PlatformCreditLedgerEntry"("createdAt");
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");
CREATE INDEX "ReferralCode_ownerUserId_idx" ON "ReferralCode"("ownerUserId");
CREATE INDEX "ReferralCode_ownerOrganizationId_idx" ON "ReferralCode"("ownerOrganizationId");
CREATE INDEX "ReferralCode_countryCode_city_idx" ON "ReferralCode"("countryCode", "city");
CREATE INDEX "ReferralCode_status_idx" ON "ReferralCode"("status");
CREATE UNIQUE INDEX "ReferralEvent_referralCodeId_referredUserId_key" ON "ReferralEvent"("referralCodeId", "referredUserId");
CREATE INDEX "ReferralEvent_referralCodeId_idx" ON "ReferralEvent"("referralCodeId");
CREATE INDEX "ReferralEvent_referredUserId_idx" ON "ReferralEvent"("referredUserId");
CREATE INDEX "ReferralEvent_referredOrganizationId_idx" ON "ReferralEvent"("referredOrganizationId");
CREATE INDEX "ReferralEvent_status_idx" ON "ReferralEvent"("status");
CREATE INDEX "ReferralEvent_createdAt_idx" ON "ReferralEvent"("createdAt");
CREATE INDEX "FoodOrder_promotionCode_idx" ON "FoodOrder"("promotionCode");
CREATE INDEX "HomeChefRequest_promotionCode_idx" ON "HomeChefRequest"("promotionCode");
CREATE INDEX "PaymentOrder_promotionCode_idx" ON "PaymentOrder"("promotionCode");
CREATE INDEX "PaymentOrder_promotionRedemptionId_idx" ON "PaymentOrder"("promotionRedemptionId");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformCreditLedgerEntry" ADD CONSTRAINT "PlatformCreditLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PlatformCreditAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralEvent" ADD CONSTRAINT "ReferralEvent_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
