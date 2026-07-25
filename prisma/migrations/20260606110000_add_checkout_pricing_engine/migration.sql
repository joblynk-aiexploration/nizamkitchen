-- CreateEnum
CREATE TYPE "PricingModule" AS ENUM ('food_order', 'home_chef_request', 'subscription', 'grocery_partner_order', 'manual_invoice');

-- CreateEnum
CREATE TYPE "PricingSellerType" AS ENUM ('home_catering', 'restaurant', 'chef_staff', 'platform');

-- CreateEnum
CREATE TYPE "PricingFulfillmentType" AS ENUM ('pickup', 'delivery', 'preorder', 'dine_in_not_applicable', 'home_service', 'digital_subscription', 'manual');

-- CreateEnum
CREATE TYPE "FeePolicyStatus" AS ENUM ('draft', 'active', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('item_subtotal', 'platform_service_fee', 'delivery_fee', 'small_order_fee', 'tax', 'regulatory_fee', 'tip', 'discount', 'platform_commission', 'seller_payout', 'payment_processing_estimate', 'travel_fee', 'ingredient_shopping_fee', 'ingredient_reimbursement', 'cancellation_fee', 'other');

-- CreateEnum
CREATE TYPE "FeeCalculationType" AS ENUM ('fixed', 'percentage', 'distance_based', 'threshold_based', 'tiered', 'manual', 'external_tax_placeholder');

-- CreateEnum
CREATE TYPE "CheckoutQuoteStatus" AS ENUM ('draft', 'active', 'accepted', 'expired', 'cancelled', 'converted_to_payment');

-- CreateEnum
CREATE TYPE "CheckoutQuoteLineType" AS ENUM ('subtotal', 'fee', 'tax', 'discount', 'tip', 'commission', 'payout', 'total');

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN "checkoutQuoteId" TEXT;

-- CreateTable
CREATE TABLE "FeePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "countryCode" TEXT,
    "region" TEXT,
    "city" TEXT,
    "module" "PricingModule" NOT NULL,
    "sellerType" "PricingSellerType",
    "fulfillmentType" "PricingFulfillmentType",
    "status" "FeePolicyStatus" NOT NULL DEFAULT 'draft',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "rulesJson" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRule" (
    "id" TEXT NOT NULL,
    "feePolicyId" TEXT NOT NULL,
    "feeType" "FeeType" NOT NULL,
    "calculationType" "FeeCalculationType" NOT NULL,
    "percentage" DECIMAL(8,4),
    "fixedAmount" DECIMAL(10,2),
    "minAmount" DECIMAL(10,2),
    "maxAmount" DECIMAL(10,2),
    "thresholdAmount" DECIMAL(10,2),
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "appliesBeforeDiscount" BOOLEAN NOT NULL DEFAULT true,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "displayToCustomer" BOOLEAN NOT NULL DEFAULT true,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutQuote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "customerOrganizationId" TEXT,
    "sellerOrganizationId" TEXT,
    "chefProfileId" TEXT,
    "module" "PricingModule" NOT NULL,
    "moduleEntityId" TEXT,
    "status" "CheckoutQuoteStatus" NOT NULL DEFAULT 'active',
    "countryCode" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "currencyCode" TEXT NOT NULL,
    "subtotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "serviceFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deliveryFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "smallOrderFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "regulatoryFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "platformCommissionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sellerAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pricingPolicySnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "inputSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutQuoteLine" (
    "id" TEXT NOT NULL,
    "checkoutQuoteId" TEXT NOT NULL,
    "lineType" "CheckoutQuoteLineType" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeePolicy_name_key" ON "FeePolicy"("name");

-- CreateIndex
CREATE INDEX "FeePolicy_countryCode_idx" ON "FeePolicy"("countryCode");
CREATE INDEX "FeePolicy_region_idx" ON "FeePolicy"("region");
CREATE INDEX "FeePolicy_city_idx" ON "FeePolicy"("city");
CREATE INDEX "FeePolicy_module_idx" ON "FeePolicy"("module");
CREATE INDEX "FeePolicy_sellerType_idx" ON "FeePolicy"("sellerType");
CREATE INDEX "FeePolicy_fulfillmentType_idx" ON "FeePolicy"("fulfillmentType");
CREATE INDEX "FeePolicy_status_idx" ON "FeePolicy"("status");
CREATE INDEX "FeePolicy_priority_idx" ON "FeePolicy"("priority");

-- CreateIndex
CREATE INDEX "FeeRule_feePolicyId_idx" ON "FeeRule"("feePolicyId");
CREATE INDEX "FeeRule_feeType_idx" ON "FeeRule"("feeType");
CREATE INDEX "FeeRule_calculationType_idx" ON "FeeRule"("calculationType");
CREATE INDEX "FeeRule_currencyCode_idx" ON "FeeRule"("currencyCode");
CREATE INDEX "FeeRule_isActive_idx" ON "FeeRule"("isActive");
CREATE INDEX "FeeRule_sortOrder_idx" ON "FeeRule"("sortOrder");

-- CreateIndex
CREATE INDEX "CheckoutQuote_organizationId_idx" ON "CheckoutQuote"("organizationId");
CREATE INDEX "CheckoutQuote_customerUserId_idx" ON "CheckoutQuote"("customerUserId");
CREATE INDEX "CheckoutQuote_customerOrganizationId_idx" ON "CheckoutQuote"("customerOrganizationId");
CREATE INDEX "CheckoutQuote_sellerOrganizationId_idx" ON "CheckoutQuote"("sellerOrganizationId");
CREATE INDEX "CheckoutQuote_chefProfileId_idx" ON "CheckoutQuote"("chefProfileId");
CREATE INDEX "CheckoutQuote_module_idx" ON "CheckoutQuote"("module");
CREATE INDEX "CheckoutQuote_moduleEntityId_idx" ON "CheckoutQuote"("moduleEntityId");
CREATE INDEX "CheckoutQuote_status_idx" ON "CheckoutQuote"("status");
CREATE INDEX "CheckoutQuote_countryCode_idx" ON "CheckoutQuote"("countryCode");
CREATE INDEX "CheckoutQuote_expiresAt_idx" ON "CheckoutQuote"("expiresAt");
CREATE INDEX "CheckoutQuote_createdAt_idx" ON "CheckoutQuote"("createdAt");

-- CreateIndex
CREATE INDEX "CheckoutQuoteLine_checkoutQuoteId_idx" ON "CheckoutQuoteLine"("checkoutQuoteId");
CREATE INDEX "CheckoutQuoteLine_lineType_idx" ON "CheckoutQuoteLine"("lineType");
CREATE INDEX "CheckoutQuoteLine_sortOrder_idx" ON "CheckoutQuoteLine"("sortOrder");

-- CreateIndex
CREATE INDEX "PaymentOrder_checkoutQuoteId_idx" ON "PaymentOrder"("checkoutQuoteId");

-- AddForeignKey
ALTER TABLE "FeeRule" ADD CONSTRAINT "FeeRule_feePolicyId_fkey" FOREIGN KEY ("feePolicyId") REFERENCES "FeePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutQuoteLine" ADD CONSTRAINT "CheckoutQuoteLine_checkoutQuoteId_fkey" FOREIGN KEY ("checkoutQuoteId") REFERENCES "CheckoutQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
