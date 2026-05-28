-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('stripe', 'paypal', 'google_pay', 'adyen', 'razorpay', 'paystack', 'flutterwave', 'mollie', 'manual', 'cash');

-- CreateEnum
CREATE TYPE "PaymentGatewayStatus" AS ENUM ('draft', 'active', 'disabled', 'error');

-- CreateEnum
CREATE TYPE "PaymentEnvironment" AS ENUM ('sandbox', 'live');

-- CreateEnum
CREATE TYPE "PaymentConfigurationStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "PaymentModule" AS ENUM ('subscription', 'food_order', 'home_chef_request', 'catering_order', 'restaurant_order', 'chef_booking', 'manual_invoice');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('draft', 'pending', 'checkout_created', 'requires_action', 'authorized', 'paid', 'partially_refunded', 'refunded', 'cancelled', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "PaymentTransactionType" AS ENUM ('authorization', 'capture', 'charge', 'refund', 'adjustment', 'payout', 'fee');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('pending', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentRefundStatus" AS ENUM ('requested', 'processing', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentWebhookStatus" AS ENUM ('received', 'processed', 'failed', 'ignored');

-- CreateEnum
CREATE TYPE "PaymentDisputeStatus" AS ENUM ('warning_needs_response', 'needs_response', 'under_review', 'won', 'lost', 'closed');

-- CreateEnum
CREATE TYPE "SellerPayoutAccountStatus" AS ENUM ('not_started', 'pending', 'active', 'restricted', 'disabled');

-- CreateEnum
CREATE TYPE "SellerPayoutStatus" AS ENUM ('pending', 'in_transit', 'paid', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "PaymentGateway" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "PaymentGatewayStatus" NOT NULL DEFAULT 'draft',
    "environment" "PaymentEnvironment" NOT NULL DEFAULT 'sandbox',
    "countryCode" TEXT,
    "supportedCountriesJson" JSONB NOT NULL,
    "supportedCurrenciesJson" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isPlatformGateway" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewayCredential" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "keyName" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "valuePreview" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewayCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentGatewaySetting" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "settingValueJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGatewaySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConfiguration" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "defaultGatewayId" TEXT,
    "allowStripe" BOOLEAN NOT NULL DEFAULT false,
    "allowPayPal" BOOLEAN NOT NULL DEFAULT false,
    "allowGooglePay" BOOLEAN NOT NULL DEFAULT false,
    "allowManualPayment" BOOLEAN NOT NULL DEFAULT true,
    "platformCommissionPercent" DECIMAL(5,2),
    "fixedCommissionAmount" DECIMAL(10,2),
    "taxPercent" DECIMAL(5,2),
    "status" "PaymentConfigurationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "customerOrganizationId" TEXT,
    "customerUserId" TEXT,
    "sellerOrganizationId" TEXT,
    "module" "PaymentModule" NOT NULL,
    "moduleEntityId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "gatewayId" TEXT,
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "platformFeeAmount" DECIMAL(10,2),
    "sellerAmount" DECIMAL(10,2),
    "taxAmount" DECIMAL(10,2),
    "providerOrderId" TEXT,
    "providerPaymentIntentId" TEXT,
    "providerCheckoutSessionId" TEXT,
    "providerCustomerId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "returnUrl" TEXT,
    "cancelUrl" TEXT,
    "metadataJson" JSONB,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "gatewayId" TEXT,
    "transactionType" "PaymentTransactionType" NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "providerChargeId" TEXT,
    "providerRefundId" TEXT,
    "providerRawJson" JSONB,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "paymentTransactionId" TEXT,
    "organizationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "gatewayId" TEXT,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'requested',
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "reason" TEXT,
    "providerRefundId" TEXT,
    "requestedById" TEXT NOT NULL,
    "processedById" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "gatewayId" TEXT,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "PaymentWebhookStatus" NOT NULL DEFAULT 'received',
    "rawJson" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentDispute" (
    "id" TEXT NOT NULL,
    "paymentOrderId" TEXT,
    "organizationId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentDisputeStatus" NOT NULL,
    "amount" DECIMAL(10,2),
    "currencyCode" TEXT,
    "providerDisputeId" TEXT NOT NULL,
    "reason" TEXT,
    "evidenceDueBy" TIMESTAMP(3),
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPayoutAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "gatewayId" TEXT,
    "status" "SellerPayoutAccountStatus" NOT NULL DEFAULT 'not_started',
    "providerAccountId" TEXT,
    "onboardingUrl" TEXT,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "countryCode" TEXT NOT NULL,
    "currencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerPayout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "gatewayId" TEXT,
    "status" "SellerPayoutStatus" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(10,2) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "providerPayoutId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentGateway_organizationId_idx" ON "PaymentGateway"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentGateway_provider_idx" ON "PaymentGateway"("provider");

-- CreateIndex
CREATE INDEX "PaymentGateway_status_idx" ON "PaymentGateway"("status");

-- CreateIndex
CREATE INDEX "PaymentGateway_environment_idx" ON "PaymentGateway"("environment");

-- CreateIndex
CREATE INDEX "PaymentGateway_countryCode_idx" ON "PaymentGateway"("countryCode");

-- CreateIndex
CREATE INDEX "PaymentGateway_isDefault_idx" ON "PaymentGateway"("isDefault");

-- CreateIndex
CREATE INDEX "PaymentGatewayCredential_gatewayId_idx" ON "PaymentGatewayCredential"("gatewayId");

-- CreateIndex
CREATE INDEX "PaymentGatewayCredential_keyName_idx" ON "PaymentGatewayCredential"("keyName");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewayCredential_gatewayId_keyName_key" ON "PaymentGatewayCredential"("gatewayId", "keyName");

-- CreateIndex
CREATE INDEX "PaymentGatewaySetting_gatewayId_idx" ON "PaymentGatewaySetting"("gatewayId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentGatewaySetting_gatewayId_settingKey_key" ON "PaymentGatewaySetting"("gatewayId", "settingKey");

-- CreateIndex
CREATE INDEX "PaymentConfiguration_countryCode_idx" ON "PaymentConfiguration"("countryCode");

-- CreateIndex
CREATE INDEX "PaymentConfiguration_currencyCode_idx" ON "PaymentConfiguration"("currencyCode");

-- CreateIndex
CREATE INDEX "PaymentConfiguration_status_idx" ON "PaymentConfiguration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentConfiguration_countryCode_currencyCode_key" ON "PaymentConfiguration"("countryCode", "currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_idempotencyKey_key" ON "PaymentOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentOrder_organizationId_idx" ON "PaymentOrder"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentOrder_countryCode_idx" ON "PaymentOrder"("countryCode");

-- CreateIndex
CREATE INDEX "PaymentOrder_customerOrganizationId_idx" ON "PaymentOrder"("customerOrganizationId");

-- CreateIndex
CREATE INDEX "PaymentOrder_customerUserId_idx" ON "PaymentOrder"("customerUserId");

-- CreateIndex
CREATE INDEX "PaymentOrder_sellerOrganizationId_idx" ON "PaymentOrder"("sellerOrganizationId");

-- CreateIndex
CREATE INDEX "PaymentOrder_module_moduleEntityId_idx" ON "PaymentOrder"("module", "moduleEntityId");

-- CreateIndex
CREATE INDEX "PaymentOrder_provider_idx" ON "PaymentOrder"("provider");

-- CreateIndex
CREATE INDEX "PaymentOrder_gatewayId_idx" ON "PaymentOrder"("gatewayId");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_idx" ON "PaymentOrder"("status");

-- CreateIndex
CREATE INDEX "PaymentOrder_createdAt_idx" ON "PaymentOrder"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentOrderId_idx" ON "PaymentTransaction"("paymentOrderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_organizationId_idx" ON "PaymentTransaction"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_provider_idx" ON "PaymentTransaction"("provider");

-- CreateIndex
CREATE INDEX "PaymentTransaction_gatewayId_idx" ON "PaymentTransaction"("gatewayId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_transactionType_idx" ON "PaymentTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentRefund_paymentOrderId_idx" ON "PaymentRefund"("paymentOrderId");

-- CreateIndex
CREATE INDEX "PaymentRefund_paymentTransactionId_idx" ON "PaymentRefund"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "PaymentRefund_organizationId_idx" ON "PaymentRefund"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentRefund_provider_idx" ON "PaymentRefund"("provider");

-- CreateIndex
CREATE INDEX "PaymentRefund_gatewayId_idx" ON "PaymentRefund"("gatewayId");

-- CreateIndex
CREATE INDEX "PaymentRefund_status_idx" ON "PaymentRefund"("status");

-- CreateIndex
CREATE INDEX "PaymentRefund_createdAt_idx" ON "PaymentRefund"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_gatewayId_idx" ON "PaymentWebhookEvent"("gatewayId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_status_idx" ON "PaymentWebhookEvent"("status");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_createdAt_idx" ON "PaymentWebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "PaymentDispute_paymentOrderId_idx" ON "PaymentDispute"("paymentOrderId");

-- CreateIndex
CREATE INDEX "PaymentDispute_organizationId_idx" ON "PaymentDispute"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentDispute_provider_idx" ON "PaymentDispute"("provider");

-- CreateIndex
CREATE INDEX "PaymentDispute_status_idx" ON "PaymentDispute"("status");

-- CreateIndex
CREATE INDEX "PaymentDispute_createdAt_idx" ON "PaymentDispute"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentDispute_provider_providerDisputeId_key" ON "PaymentDispute"("provider", "providerDisputeId");

-- CreateIndex
CREATE INDEX "SellerPayoutAccount_organizationId_idx" ON "SellerPayoutAccount"("organizationId");

-- CreateIndex
CREATE INDEX "SellerPayoutAccount_provider_idx" ON "SellerPayoutAccount"("provider");

-- CreateIndex
CREATE INDEX "SellerPayoutAccount_gatewayId_idx" ON "SellerPayoutAccount"("gatewayId");

-- CreateIndex
CREATE INDEX "SellerPayoutAccount_status_idx" ON "SellerPayoutAccount"("status");

-- CreateIndex
CREATE INDEX "SellerPayoutAccount_countryCode_idx" ON "SellerPayoutAccount"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "SellerPayoutAccount_organizationId_provider_key" ON "SellerPayoutAccount"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "SellerPayout_organizationId_idx" ON "SellerPayout"("organizationId");

-- CreateIndex
CREATE INDEX "SellerPayout_provider_idx" ON "SellerPayout"("provider");

-- CreateIndex
CREATE INDEX "SellerPayout_gatewayId_idx" ON "SellerPayout"("gatewayId");

-- CreateIndex
CREATE INDEX "SellerPayout_status_idx" ON "SellerPayout"("status");

-- CreateIndex
CREATE INDEX "SellerPayout_createdAt_idx" ON "SellerPayout"("createdAt");

-- AddForeignKey
ALTER TABLE "PaymentGateway" ADD CONSTRAINT "PaymentGateway_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGatewayCredential" ADD CONSTRAINT "PaymentGatewayCredential_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentGatewaySetting" ADD CONSTRAINT "PaymentGatewaySetting_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "PaymentGateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayoutAccount" ADD CONSTRAINT "SellerPayoutAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerPayout" ADD CONSTRAINT "SellerPayout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SeedFeatureFlags
INSERT INTO "FeatureFlag" ("id", "key", "name", "description", "enabled", "createdAt", "updatedAt")
VALUES
  ('payments_global_feature_flag', 'payments', 'payments', 'Controls payment infrastructure visibility and payment-order creation.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('live_checkout_global_feature_flag', 'live_checkout', 'live checkout', 'Controls hosted checkout buttons for live customer payment flows.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stripe_payments_global_feature_flag', 'stripe_payments', 'stripe payments', 'Controls Stripe gateway availability.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('paypal_payments_global_feature_flag', 'paypal_payments', 'paypal payments', 'Controls PayPal gateway availability.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('google_pay_wallet_global_feature_flag', 'google_pay_wallet', 'google pay wallet', 'Controls Google Pay wallet availability through configured gateways.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seller_payouts_global_feature_flag', 'seller_payouts', 'seller payouts', 'Controls seller payout account and payout workflows.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('payment_refunds_global_feature_flag', 'payment_refunds', 'payment refunds', 'Controls refund operations.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('payment_disputes_global_feature_flag', 'payment_disputes', 'payment disputes', 'Controls payment dispute visibility and workflows.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key", "organizationId", "countryCode") DO NOTHING;
